from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.purchase_order import (
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    PurchaseOrderListItem, MaterialRequirement, OrderProgress, OrderStatusUpdate,
    TeamAssignment, PurchaseOrderValidation
)
from app.schemas.user import UserResponse
from app.services.purchase_order_service import purchase_order_service
from app.api.deps import get_current_user, require_role
from decimal import Decimal

router = APIRouter()


@router.post("/", response_model=PurchaseOrderResponse, status_code=201)
async def create_purchase_order(
    order_data: PurchaseOrderCreate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Create a new purchase order.
    
    - Auto-generates order number (PO-YYYY-XXXX)
    - Calculates material requirements from BOM
    - Checks material availability
    - **product_id**: Finished goods product
    - **quantity**: Order quantity
    - **due_date**: Target completion date
    - **priority**: Low/Medium/High/Urgent
    - **customer_name**: Customer name (optional)
    - **production_stage**: Current stage (optional)
    - **shift_number**: Shift assignment (optional)
    - **start_time**: Production start time (optional)
    - **end_time**: Production end time (optional)
    """
    return await purchase_order_service.create_purchase_order(order_data, current_user.id)


@router.post("/{order_id}/duplicate", response_model=PurchaseOrderResponse, status_code=201)
async def duplicate_purchase_order(
    order_id: str,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Duplicate an existing purchase order.
    
    Creates a new order with:
    - Same product and quantity
    - Same BOM and material requirements
    - New order number
    - Due date set to 7 days from now
    - Status: Planned
    """
    return await purchase_order_service.duplicate_purchase_order(order_id, current_user.id)


@router.get("/", response_model=List[PurchaseOrderListItem])
async def list_purchase_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    due_date_from: Optional[str] = None,
    due_date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all purchase orders with filters.
    
    - **status**: Planned/In Progress/Completed/Cancelled
    - **priority**: Low/Medium/High/Urgent
    - **search**: Search in order number or product name
    - **due_date_from/to**: Date range filter
    """
    return await purchase_order_service.list_purchase_orders(
        page, limit, status, priority, search, due_date_from, due_date_to
    )


@router.get("/{order_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get purchase order details with material requirements.
    """
    return await purchase_order_service.get_order_by_id(order_id)


@router.put("/{order_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    order_id: str,
    order_data: PurchaseOrderUpdate,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Update purchase order (only if status is Planned).
    """
    return await purchase_order_service.update_purchase_order(order_id, order_data, current_user.id)


@router.put("/{order_id}/status", response_model=PurchaseOrderResponse)
async def update_order_status(
    order_id: str,
    status_data: OrderStatusUpdate,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Update order status.
    
    Workflow: Planned → In Progress → Completed
    Can cancel from any state
    """
    return await purchase_order_service.update_order_status(order_id, status_data, current_user.id)


@router.post("/{order_id}/archive", response_model=PurchaseOrderResponse)
async def archive_purchase_order(
    order_id: str,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Archive a purchase order.
    
    Only completed or cancelled orders can be archived.
    Archived orders are hidden from main list but can be retrieved.
    """
    return await purchase_order_service.archive_purchase_order(order_id, current_user.id)


@router.delete("/{order_id}")
async def cancel_purchase_order(
    order_id: str,
    current_user: UserResponse = Depends(require_role("Planner"))
):
    """
    Cancel purchase order.
    
    Cannot cancel if materials already issued or WIP exists.
    """
    return await purchase_order_service.cancel_purchase_order(order_id, current_user.id)


@router.get("/{order_id}/materials", response_model=List[MaterialRequirement])
async def get_order_materials(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get calculated material requirements for order.
    
    Shows:
    - Required quantity (with scrap %)
    - Available quantity
    - Shortage quantity
    - Availability status
    """
    return await purchase_order_service.get_order_materials(order_id)


@router.get("/{order_id}/progress", response_model=OrderProgress)
async def get_order_progress(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get order progress through stages.
    
    Returns stage completion status and timelines.
    """
    return await purchase_order_service.get_order_progress(order_id)


@router.post("/{order_id}/assign")
async def assign_team_to_order(
    order_id: str,
    user_ids: List[str],
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Assign team members to purchase order.
    """
    return await purchase_order_service.assign_team(order_id, user_ids, current_user.id)


@router.get("/{order_id}/team", response_model=List[TeamAssignment])
async def get_order_team(
    order_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get team assignments for order.
    """
    return await purchase_order_service.get_team_assignments(order_id)

@router.post("/validate-purchase", response_model=PurchaseOrderValidation)
async def validate_purchase_feasibility(
    product_id: str = Query(..., description="Finished goods product ID"),
    quantity: Decimal = Query(..., gt=0, description="Purchase quantity"),
    target_location_id: Optional[str] = Query(None, description="Check inventory at specific location"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Validate if purchase order can be fulfilled with current inventory.
    
    **Features:**
    - Checks material availability before creating order
    - Shows exact shortage quantities
    - Returns feasibility status (can_produce: true/false)
    - Helps with purchase planning
    
    **Use Cases:**
    - Pre-purchase validation
    - Material planning
    - Order feasibility check
    - Quick shortage preview
    
    **Parameters:**
    - **product_id**: Finished goods product ID
    - **quantity**: Purchase quantity to validate
    - **target_location_id**: (Optional) Check specific warehouse
    
    **Response:**
    - can_produce: true/false
    - Material-wise shortage details
    - Summary of procurement needs
    """
    return await purchase_order_service.validate_purchase_feasibility(
        product_id=product_id,
        quantity=quantity,
        target_location_id=target_location_id
    )
