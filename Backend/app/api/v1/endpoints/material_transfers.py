from fastapi import APIRouter, Depends, Query, status
from typing import List, Optional
from app.schemas.material_transfer import (
    MaterialTransferCreate, MaterialTransferUpdate, MaterialTransferResponse,
    MaterialTransferListItem, TransferApprovalRequest,
    WIPStageTransferCreate, WIPStageTransferResponse, WIPStageResponse,
    WIPStageWithUnits
)
from app.schemas.user import UserResponse
from app.services.material_transfer_service import material_transfer_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


# =============================================
# STANDARD MATERIAL TRANSFER ENDPOINTS
# =============================================

@router.post("/", response_model=MaterialTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_transfer(
    transfer_data: MaterialTransferCreate,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Create a new material transfer request.
    
    - Auto-generates transfer number (TRF-YYYY-XXXX)
    - Validates inventory availability at source
    - Status starts as 'Pending'
    - Requires Store Manager or Supervisor role
    """
    return await material_transfer_service.create_transfer(transfer_data, current_user.id)


@router.get("/", response_model=List[MaterialTransferListItem])
async def list_transfers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    from_location_id: Optional[str] = None,
    to_location_id: Optional[str] = None,
    product_id: Optional[str] = None,
    search: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List material transfers with filters.
    
    - Filter by status, locations, product
    - Search by transfer number or product name
    - Paginated results
    """
    return await material_transfer_service.list_transfers(
        page=page,
        limit=limit,
        status=status,
        from_location_id=from_location_id,
        to_location_id=to_location_id,
        product_id=product_id,
        search=search
    )


@router.get("/pending", response_model=List[MaterialTransferListItem])
async def list_pending_transfers(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all pending transfers (for approval queue).
    
    Quick access to transfers awaiting approval.
    """
    return await material_transfer_service.list_transfers(
        page=1,
        limit=50,
        status='Pending'
    )


@router.get("/{transfer_id}", response_model=MaterialTransferResponse)
async def get_transfer(
    transfer_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get transfer by ID with full details.
    
    Includes product info, location names, user names, and timestamps.
    """
    return await material_transfer_service.get_transfer_by_id(transfer_id)


@router.post("/{transfer_id}/approve", response_model=MaterialTransferResponse)
async def approve_transfer(
    transfer_id: str,
    approval: TransferApprovalRequest,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Approve or reject a transfer request.
    
    - Set approve=true to approve
    - Set approve=false to reject
    - Optional notes for reason
    - Requires Store Manager role
    """
    return await material_transfer_service.approve_transfer(transfer_id, approval, current_user.id)


@router.post("/{transfer_id}/execute", response_model=MaterialTransferResponse)
async def execute_transfer(
    transfer_id: str,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Execute approved transfer - update inventory.
    
    - Deducts from source location
    - Adds to destination location
    - Logs inventory transaction
    - Changes status from 'Approved' to 'Completed'
    - Atomic operation
    """
    return await material_transfer_service.execute_transfer(transfer_id, current_user.id)


@router.delete("/{transfer_id}", status_code=status.HTTP_200_OK)
async def cancel_transfer(
    transfer_id: str,
    current_user: UserResponse = Depends(require_role("Store Manager"))
):
    """
    Cancel a transfer (only Pending or Approved).
    
    Sets status to 'Cancelled'.
    """
    return await material_transfer_service.cancel_transfer(transfer_id)


# =============================================
# WIP STAGE TRANSFER ENDPOINTS
# =============================================

@router.get("/wip-stages", response_model=List[WIPStageResponse])
async def list_wip_stages(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get all WIP stages in sequence.
    
    Returns stages like: Cutting → Sewing → Finishing → QC → Packing
    """
    return await material_transfer_service.list_wip_stages()


@router.get("/wip-stages/with-units", response_model=List[WIPStageWithUnits])
async def get_wip_stages_with_units(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get WIP stages with current unit counts.
    
    Shows how many units are currently in each stage.
    Used for WIP Board visualization.
    """
    return await material_transfer_service.get_wip_stages_with_units()


@router.post("/wip-stage-transfer", response_model=WIPStageTransferResponse, status_code=status.HTTP_201_CREATED)
async def create_wip_stage_transfer(
    wip_transfer: WIPStageTransferCreate,
    current_user: UserResponse = Depends(require_role("Supervisor"))
):
    """
    Move production order between WIP stages.
    
    - Tracks order movement through production stages
    - Updates order stage tracking
    - Records actual time spent in previous stage
    - Used for WIP Board stage transitions
    """
    return await material_transfer_service.create_wip_stage_transfer(wip_transfer, current_user.id)