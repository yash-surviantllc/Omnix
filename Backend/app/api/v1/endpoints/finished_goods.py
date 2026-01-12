from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.finished_good import (
    FinishedGoodCreate, FinishedGoodUpdate, FinishedGoodResponse,
    DispatchCreate, DispatchUpdate, DispatchResponse, POProgressResponse
)
from app.schemas.user import UserResponse
from app.services.finished_good_service import finished_good_service
from app.api.deps import get_current_user

router = APIRouter()


@router.post("/", response_model=FinishedGoodResponse, status_code=201)
async def create_finished_good(
    fg_data: FinishedGoodCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create finished good entry when work order completes.
    
    - Automatically updates PO quantities
    - Moves completed items to FG inventory
    """
    return await finished_good_service.create_finished_good(fg_data, current_user.id)


@router.get("/", response_model=List[FinishedGoodResponse])
async def list_finished_goods(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    purchase_order_id: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List finished goods with filters.
    
    - **product_id**: Filter by product
    - **status**: In Stock/Dispatched
    - **purchase_order_id**: Filter by PO
    """
    return await finished_good_service.list_finished_goods(
        page, limit, product_id, status, purchase_order_id
    )


@router.get("/{fg_id}", response_model=FinishedGoodResponse)
async def get_finished_good(
    fg_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get finished good details"""
    return await finished_good_service.get_finished_good_by_id(fg_id)


@router.post("/dispatch", response_model=DispatchResponse, status_code=201)
async def create_dispatch(
    dispatch_data: DispatchCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create dispatch record for finished goods.
    
    - Reduces FG inventory
    - Updates PO dispatch quantities
    - Tracks delivery details
    """
    return await finished_good_service.create_dispatch(dispatch_data, current_user.id)


@router.get("/dispatch/{dispatch_id}", response_model=DispatchResponse)
async def get_dispatch(
    dispatch_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get dispatch details"""
    return await finished_good_service.get_dispatch_by_id(dispatch_id)


@router.get("/progress/{po_id}", response_model=POProgressResponse)
async def get_po_progress(
    po_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get purchase order progress tracking.
    
    Shows:
    - Ordered quantity per SKU
    - Work orders created
    - Quantity completed
    - Quantity pending
    - Quantity in FG
    - Quantity dispatched
    - Quantity reworked/scrapped
    
    Includes drill-down to contributing work orders.
    """
    return await finished_good_service.get_po_progress(po_id)
