from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.wip import (
    WorkingOrderCreate, WorkingOrderUpdate, WorkingOrderResponse, WorkingOrderListItem,
    WIPStageMetricsResponse, WIPDashboardResponse, WIPSummaryStats,
    BottleneckAlert, StagePerformanceHistoryResponse
)
from app.schemas.user import UserResponse
from app.services.wip_service import wip_service
from app.api.deps import get_current_user, require_role

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
    - Links to production order
    - Assigns to workstation/team
    - Sets target quantity and schedule
    """
    return await wip_service.create_working_order(order_data, current_user.id)


@router.get("/working-orders", response_model=List[WorkingOrderListItem])
async def list_working_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    operation: Optional[str] = None,
    production_order_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List working orders with filters.
    
    - **status**: Pending/In Progress/Completed/On Hold/Cancelled
    - **operation**: Filter by operation (Cutting, Sewing, etc.)
    - **production_order_id**: Filter by production order
    """
    return await wip_service.list_working_orders(page, limit, status, operation, production_order_id)


@router.get("/working-orders/{order_id}", response_model=WorkingOrderResponse)
async def get_working_order(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get working order details by ID"""
    return await wip_service.get_working_order_by_id(order_id)


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
    current_user: UserResponse = Depends(require_role("Supervisor"))
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
