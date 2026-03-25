from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.wip import (
    WorkingOrderCreate, WorkingOrderUpdate, WorkingOrderResponse, WorkingOrderListItem,
    UniqueWorkingOrderItem,
    WIPStageMetricsResponse, WIPDashboardResponse, WIPSummaryStats,
    BottleneckAlert, StagePerformanceHistoryResponse
)
from app.schemas.material_transfer import WIPStageResponse
from app.schemas.user import UserResponse
from app.services.wip_service import wip_service
from app.api.deps import get_current_user, require_role, block_worker_delete, require_worker_module_access

router = APIRouter()


# ============================================
# WORKING ORDERS ENDPOINTS
# ============================================

@router.post("/working-orders", response_model=WorkingOrderResponse, status_code=201)
async def create_working_order(
    order_data: WorkingOrderCreate,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Create a new working order.
    
    - Auto-generates work order number (WO-YYYY-XXXX)
    - Links to purchase order
    - Assigns to workstation/team
    - Sets target quantity and schedule
    """
    return await wip_service.create_working_order(order_data, current_user.id)


@router.get("/working-orders", response_model=List[WorkingOrderListItem])
async def list_working_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[List[str]] = Query(None),
    operation: Optional[str] = None,
    purchase_order_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List working orders with filters.
    
    - **status**: Pending/In Progress/Completed/On Hold/Cancelled
    - **operation**: Filter by operation (Cutting, Sewing, etc.)
    - **purchase_order_id**: Filter by purchase order
    - **search**: Search by work order number or operation
    """
    return await wip_service.list_working_orders(page, limit, status, operation, purchase_order_id, search)


@router.get("/working-orders/unique", response_model=List[UniqueWorkingOrderItem])
async def list_unique_working_orders(
    status: Optional[List[str]] = Query(None),
    purchase_order_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get unique working orders (grouped by work_order_number).
    Used for dropdowns where we need to select a work order, not an operation.
    
    - **status**: Filter by status (Pending/In Progress/Completed/On Hold/Cancelled)
    - **purchase_order_id**: Filter by linked purchase order
    """
    return await wip_service.list_unique_working_orders(status, purchase_order_id)


@router.get("/working-orders/{work_order_number}/stages", response_model=List[WIPStageResponse])
async def get_work_order_stages(
    work_order_number: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get configured WIP stages for a specific work order.
    Returns only the stages assigned to the work order's configuration.
    """
    return await wip_service.get_work_order_stages(work_order_number)



@router.get("/working-orders/{order_id}", response_model=WorkingOrderResponse)
async def get_working_order(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get working order details by ID"""
    """Get working order details by ID"""
    return await wip_service.get_working_order_by_id(order_id)


@router.post("/working-orders/{work_order_number}/start", response_model=WorkingOrderResponse)
async def start_operation_endpoint(
    work_order_number: str,
    operation: str = Query(..., description="Name of the operation to start"),
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Start a specific operation for a Work Order.
    Creates the operation record if it doesn't exist.
    """
    return await wip_service.start_operation(work_order_number, operation, current_user.id)


@router.post("/working-orders/{work_order_number}/pause", response_model=WorkingOrderResponse)
async def pause_operation_endpoint(
    work_order_number: str,
    operation: str = Query(..., description="Name of the operation to pause"),
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Pause an in-progress operation for a Work Order.
    Changes operation status to 'On Hold'.
    """
    return await wip_service.pause_operation(work_order_number, operation, current_user.id)


@router.post("/working-orders/{work_order_number}/complete", response_model=WorkingOrderResponse)
async def complete_operation_endpoint(
    work_order_number: str,
    operation: str = Query(..., description="Name of the operation to complete"),
    completed_qty: Optional[float] = Query(None, description="Completed quantity (defaults to target qty)"),
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Complete an in-progress operation for a Work Order.
    Changes operation status to 'Completed' and records completion time.
    """
    return await wip_service.complete_operation(work_order_number, operation, current_user.id, completed_qty)



@router.put("/working-orders/{order_id}", response_model=WorkingOrderResponse)
async def update_working_order(
    order_id: str,
    order_data: WorkingOrderUpdate,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Update working order.
    
    - Update progress (completed_qty, rejected_qty)
    - Change status
    - Update schedule
    - Automatically recalculates WIP metrics
    """
    return await wip_service.update_working_order(order_id, order_data, current_user.id)


@router.delete("/working-orders/{order_id}")
async def cancel_working_order(
    order_id: str,
    current_user: UserResponse = Depends(require_role(["Supervisor", "Worker"])),
    _module_guard: UserResponse = Depends(require_worker_module_access("wip"))
):
    """Cancel working order"""
    return await wip_service.delete_working_order(order_id)


# ============================================
# WIP DASHBOARD ENDPOINTS
# ============================================

@router.get("/dashboard", response_model=WIPDashboardResponse)
async def get_wip_dashboard(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get complete WIP Live Board dashboard data.
    
    **Returns:**
    - Stage-wise metrics (orders, units, avg time, utilization, health)
    - Total orders and units in WIP
    - Average cycle time
    - Bottleneck identification
    - Last updated timestamp
    
    **Use Case:**
    - Main data source for WIP Live Board UI
    - Real-time production monitoring
    - Bottleneck detection
    """
    return await wip_service.get_wip_dashboard()


@router.get("/stages", response_model=List[WIPStageMetricsResponse])
async def get_stage_metrics(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get detailed metrics for all WIP stages.
    
    Shows current state of each production stage with:
    - Orders and units count
    - Average processing time vs target
    - Capacity utilization percentage
    - Health status (healthy/warning/delayed)
    """
    return await wip_service.get_stage_metrics()


@router.get("/bottlenecks", response_model=List[BottleneckAlert])
async def get_bottleneck_alerts(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get bottleneck alerts for stages with issues.
    
    Returns stages with warning or delayed status,
    sorted by severity (utilization percentage).
    """
    return await wip_service.get_bottleneck_alerts()


@router.get("/summary", response_model=WIPSummaryStats)
async def get_wip_summary(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get WIP summary statistics.
    
    Provides high-level overview:
    - Total orders and units in WIP
    - Average cycle time
    - Bottleneck stage
    - Count of healthy/warning/delayed stages
    """
    return await wip_service.get_summary_stats()


@router.get("/stages/{stage_name}/history", response_model=List[StagePerformanceHistoryResponse])
async def get_stage_history(
    stage_name: str,
    days: int = Query(7, ge=1, le=30),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get historical performance data for a specific stage.
    
    - **stage_name**: Stage name (e.g., "Cutting", "Sewing")
    - **days**: Number of days of history (1-30)
    
    Returns daily performance metrics for trend analysis.
    """
    return await wip_service.get_stage_performance_history(stage_name, days)


@router.get("/working-orders/{work_order_id}/transferred-quantities")
async def get_transferred_quantities(
    work_order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get aggregated transferred quantities per stage for a work order.
    
    IMPORTANT: The frontend sends work_order_operations.id, but transfers
    are stored against work_orders.id. This function handles both cases.
    """
    from app.database import get_db
    
    db = get_db()
    
    # Step 1: Check if this is an operation ID (from work_order_operations table)
    # The frontend sends operation IDs because list_working_orders returns them
    op_check = db.table('work_order_operations').select('work_order_id').eq('id', work_order_id).limit(1).execute()
    
    if op_check.data:
        # This is an operation ID, get the parent work_order_id
        actual_work_order_id = op_check.data[0]['work_order_id']
    else:
        # Might be a direct work_order ID (legacy case)
        actual_work_order_id = work_order_id
    
    # Step 2: Get the Purchase Order ID for this work order
    wo_res = db.table('work_orders').select('purchase_order_id').eq('id', actual_work_order_id).limit(1).execute()
    
    if not wo_res.data:
        # Work order doesn't exist
        return {}
    
    purchase_order_id = wo_res.data[0].get('purchase_order_id')
    
    if not purchase_order_id:
        # No purchase order linked, can only check this specific work order
        target_ids = [actual_work_order_id]
    else:
        # Step 3: Get ALL work order IDs for this purchase order
        # This allows us to see transfers across all operations of the same production run
        related_ops = db.table('work_orders').select('id').eq('purchase_order_id', purchase_order_id).execute()
        target_ids = [row['id'] for row in related_ops.data]
    
    if not target_ids:
        return {}
    
    # Step 4: Query transfers where order_id matches any of the target work_order IDs
    transfers = db.table('wip_stage_transfers').select(
        'to_stage_id',
        'quantity'
    ).in_('order_id', target_ids).execute()
    
    # Step 5: Aggregate quantities by destination stage
    stage_quantities = {}
    for transfer in transfers.data:
        stage_id = transfer['to_stage_id']
        quantity = float(transfer['quantity'])
        
        if stage_id in stage_quantities:
            stage_quantities[stage_id] += quantity
        else:
            stage_quantities[stage_id] = quantity
    
    return stage_quantities
