"""
Material Requisition API Endpoints
REST API for creating and managing material requisitions
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from app.schemas.material_requisition import (
    MaterialRequisitionCreate,
    MaterialRequisitionUpdate,
    MaterialRequisitionResponse,
    MaterialRequisitionSummary
)
from app.schemas.user import UserResponse
from app.services.material_requisition_service import material_requisition_service
from app.services.dashboard_service import dashboard_service
from app.api.deps import get_current_user, block_worker_delete, require_worker_module_access

router = APIRouter()


@router.post("", response_model=MaterialRequisitionResponse, status_code=201)
async def create_material_requisition(
    data: MaterialRequisitionCreate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Create a new material requisition
    
    - **work_order_number**: Optional work order reference
    - **department**: Requesting department (required)
    - **requesting_stage**: Stage/operation requesting materials
    - **requested_by**: Person requesting (name and role)
    - **reviewed_by**: Person who reviewed
    - **shift**: Shift number (Shift 1, Shift 2, Shift 3)
    - **items**: List of materials requested (at least 1 required)
    
    Returns a complete requisition with auto-generated requisition number (MR-YYYY-NNNN format)
    """
    try:
        new_req = await material_requisition_service.create_requisition(
            data,
            current_user.id
        )
        await dashboard_service.broadcast_activities_update()
        return new_req
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[MaterialRequisitionSummary])
async def list_material_requisitions(
    limit: int = Query(default=50, le=100, description="Maximum number of results"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
    status: Optional[str] = Query(default=None, description="Filter by status"),
    department: Optional[str] = Query(default=None, description="Filter by department"),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List material requisitions with optional filters
    
    Returns summary view with item counts and total quantities
    """
    try:
        return await material_requisition_service.list_requisitions(
            limit=limit,
            offset=offset,
            status=status,
            department=department
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{requisition_id}", response_model=MaterialRequisitionResponse)
async def get_material_requisition(
    requisition_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get a material requisition by ID
    
    Returns complete requisition with all items
    """
    try:
        return await material_requisition_service.get_requisition(requisition_id)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/number/{requisition_number}", response_model=MaterialRequisitionResponse)
async def get_material_requisition_by_number(
    requisition_number: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get a material requisition by requisition number
    
    Example: MR-2026-0001
    """
    try:
        return await material_requisition_service.get_requisition_by_number(requisition_number)
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{requisition_id}", response_model=MaterialRequisitionResponse)
async def update_material_requisition(
    requisition_id: str,
    data: MaterialRequisitionUpdate,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update a material requisition
    
    Can update status, reviewed_by, and delivery_instructions
    """
    try:
        updated_req = await material_requisition_service.update_requisition(requisition_id, data)
        await dashboard_service.broadcast_activities_update()
        return updated_req
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{requisition_id}")
async def cancel_material_requisition(
    requisition_id: str,
    current_user: UserResponse = Depends(get_current_user),
    _module_guard: UserResponse = Depends(require_worker_module_access("material-request"))
):
    """
    Cancel a material requisition (soft delete)
    
    Sets status to 'Cancelled' instead of deleting the record
    """
    try:
        result = await material_requisition_service.delete_requisition(requisition_id)
        await dashboard_service.broadcast_activities_update()
        return result
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{requisition_id}/approve", response_model=MaterialRequisitionResponse)
async def approve_material_requisition(
    requisition_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Approve a material requisition
    
    Sets status to 'Approved'
    """
    try:
        # Create a partial update object
        # Fix: current_user is a Pydantic model (UserResponse), not a dict
        full_name = getattr(current_user, 'full_name', 'Unknown')
        
        update_data = MaterialRequisitionUpdate(
            status="Approved",
            reviewed_by=full_name
        )
        result = await material_requisition_service.update_requisition(requisition_id, update_data)
        await dashboard_service.broadcast_activities_update()
        # Also broadcast KPIs as approval likely affects stock pending status etc.
        await dashboard_service.broadcast_kpis_update()
        return result
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
