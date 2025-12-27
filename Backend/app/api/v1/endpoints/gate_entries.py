from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from app.schemas.gate_entry import (
    GateEntryCreate, GateEntryUpdate, GateEntryResponse,
    GateEntryListItem, GateEntryStatusUpdate, GateEntryStats
)
from app.schemas.user import UserResponse
from app.services.gate_entry_service import gate_entry_service
from app.api.deps import get_current_user, require_role

router = APIRouter()


@router.post("/", response_model=GateEntryResponse, status_code=201)
async def create_gate_entry(
    entry_data: GateEntryCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create a new gate entry (inward).
    
    - Auto-generates entry number (GE-YYYY-XXXX)
    - Records incoming materials, deliveries, visitors
    - **entry_type**: material, courier, visitor, jobwork_return, subcontract_return, delivery, machine_spare
    - **vendor**: Vendor/source name
    - **vehicle_no**: Vehicle number (optional)
    - **driver_name**: Driver name (optional)
    - **linked_document**: PO/Invoice/DC/AWB number (optional)
    - **destination_department**: Store, QA, Maintenance, Production, Admin
    - **materials**: List of materials/items with code, name, quantity, UOM
    - **remarks**: Additional notes (optional)
    """
    return await gate_entry_service.create_gate_entry(entry_data, current_user.id)


@router.get("/", response_model=List[GateEntryListItem])
async def list_gate_entries(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    entry_type: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List all gate entries with filters.
    
    - **status**: arrived, under_verification, accepted, rejected
    - **entry_type**: material, courier, visitor, jobwork_return, subcontract_return, delivery, machine_spare
    - **search**: Search in vendor name or entry number
    - **date_from/date_to**: Date range filter
    """
    return await gate_entry_service.list_gate_entries(
        page, limit, status, entry_type, search, date_from, date_to
    )


@router.get("/stats", response_model=GateEntryStats)
async def get_gate_entry_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get gate entry statistics.
    
    Returns:
    - Total entries count
    - Count by status (arrived, under_verification, accepted, rejected)
    - Today's entries count
    - Count by entry type
    - Count by destination department
    """
    return await gate_entry_service.get_gate_entry_stats()


@router.get("/{entry_id}", response_model=GateEntryResponse)
async def get_gate_entry(
    entry_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get gate entry details with materials.
    """
    return await gate_entry_service.get_entry_by_id(entry_id)


@router.put("/{entry_id}", response_model=GateEntryResponse)
async def update_gate_entry(
    entry_id: str,
    entry_data: GateEntryUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update gate entry details.
    
    Can update vendor, vehicle, driver, materials, etc.
    """
    return await gate_entry_service.update_gate_entry(entry_id, entry_data, current_user.id)


@router.put("/{entry_id}/status", response_model=GateEntryResponse)
async def update_entry_status(
    entry_id: str,
    status_data: GateEntryStatusUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update gate entry status.
    
    Workflow: arrived → under_verification → accepted/rejected
    
    - **status**: arrived, under_verification, accepted, rejected
    - **remarks**: Optional notes about status change
    """
    return await gate_entry_service.update_entry_status(entry_id, status_data, current_user.id)


@router.delete("/{entry_id}")
async def delete_gate_entry(
    entry_id: str,
    current_user: UserResponse = Depends(require_role("Admin"))
):
    """
    Delete gate entry.
    
    Only entries with 'arrived' or 'rejected' status can be deleted.
    Requires Admin role.
    """
    return await gate_entry_service.delete_gate_entry(entry_id, current_user.id)
