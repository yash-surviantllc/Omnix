from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from datetime import date
from app.schemas.material_request import (
    MaterialRequestCreate, MaterialRequestUpdate, MaterialRequestResponse,
    MaterialRequestListItem, ReviewRequest, ApprovalRequest,
    PickListResponse, QuickRequestTemplate, StockAvailabilityCheck,
    StockAvailabilityResponse
)
from app.schemas.user import UserResponse
from app.services.material_request_service import material_request_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


@router.post("/", response_model=MaterialRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_request(
    request_data: MaterialRequestCreate,
    current_user: UserResponse = Depends(require_role("Operator"))
):
    """
    Create a new material request.
    
    - Auto-generates request number (MR-YYYY-XXXX)
    - Checks stock availability for each item
    - Status starts as 'Pending'
    - Operators, Supervisors can create requests
    """
    return await material_request_service.create_request(request_data, current_user.id)


@router.get("/", response_model=List[MaterialRequestListItem])
async def list_requests(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    department: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List material requests with filters.
    
    - Filter by status, department, date range
    - Search by request number or department
    """
    return await material_request_service.list_requests(
        page=page,
        limit=limit,
        status=status,
        department=department,
        start_date=start_date,
        end_date=end_date,
        search=search
    )


@router.get("/pending", response_model=List[MaterialRequestListItem])
async def list_pending_requests(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all pending requests (for review/approval queue).
    """
    return await material_request_service.list_requests(
        page=1,
        limit=50,
        status='Pending'
    )


@router.get("/templates", response_model=List[QuickRequestTemplate])
async def get_quick_templates(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get quick request templates.
    
    Used for Quick Actions in the UI (e.g., "Cotton Fabric - Cutting Floor").
    """
    return await material_request_service.get_quick_templates()


@router.post("/check-stock", response_model=List[StockAvailabilityResponse])
async def check_stock_availability(
    stock_check: StockAvailabilityCheck,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Check stock availability for request items.
    
    Shows Available, Partial, or Shortage status for each item.
    """
    return await material_request_service.check_stock_availability(stock_check)


@router.get("/{request_id}", response_model=MaterialRequestResponse)
async def get_request(
    request_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get material request by ID with all items.
    
    Includes stock availability status for each item.
    """
    return await material_request_service.get_request_by_id(request_id)


@router.post("/{request_id}/review", response_model=MaterialRequestResponse)
async def review_request(
    request_id: str,
    review: ReviewRequest,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Review material request (Store Reviewer).
    
    Changes status from 'Pending' to 'Reviewed'.
    Forwards to approver.
    """
    return await material_request_service.review_request(request_id, review, current_user.id)


@router.post("/{request_id}/approve", response_model=MaterialRequestResponse)
async def approve_request(
    request_id: str,
    approval: ApprovalRequest,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Approve material request (full or partial).
    
    - Set approve_all=true for full approval
    - Provide item_approvals for partial quantities
    - Auto-creates material transfers if enabled
    - Status changes to 'Approved' or 'Partially Approved'
    """
    return await material_request_service.approve_request(request_id, approval, current_user.id)


@router.post("/{request_id}/reject", status_code=status.HTTP_200_OK)
async def reject_request(
    request_id: str,
    notes: Optional[str] = None,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Reject material request.
    
    Sets status to 'Rejected'.
    """
    return await material_request_service.reject_request(request_id, notes, current_user.id)


@router.get("/{request_id}/pick-list", response_model=PickListResponse)
async def generate_pick_list(
    request_id: str,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Generate pick list for approved request.
    
    Shows all approved items with locations for store team to pick.
    """
    return await material_request_service.generate_pick_list(request_id)