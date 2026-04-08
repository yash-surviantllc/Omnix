from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from app.schemas.qc import (
    QCInspectionCreate, QCInspectionResponse, QCStats
)
from app.schemas.user import UserResponse
from app.services.qc_service import QCService
from app.api.deps import get_current_user, require_role, require_worker_module_access

router = APIRouter()

class OrderLookupResponse(BaseModel):
    order_type: str  # 'purchase_order' or 'work_order'
    order_id: str
    order_number: str
    product_id: str
    product_name: Optional[str] = None
    product_code: Optional[str] = None
    quantity: float
    completed_qty: float = 0
    status: str

@router.post("/", response_model=QCInspectionResponse)
async def create_inspection(
    inspection: QCInspectionCreate,
    current_user: UserResponse = Depends(require_role(["Supervisor", "Worker"])),
    _module_guard: UserResponse = Depends(require_worker_module_access("qc"))
):
    """
    Create a new QC inspection.
    """
    try:
        # UserResponse is a Pydantic model, access id as an attribute
        user_id = current_user.id
        return await QCService.create_inspection(inspection, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[QCInspectionResponse])
async def list_inspections(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List QC inspections.
    """
    try:
        return await QCService.list_inspections(page, limit, status)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/stats", response_model=QCStats)
async def get_qc_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get QC Dashboard statistics.
    """
    try:
        return await QCService.get_stats()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/trends")
async def get_qc_trends(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get 7-day QC yield trends.
    """
    try:
        # For now return mock data or implement simple history fetch
        # In a real app, this would query a daily_metrics table
        return [
            {"date": "2024-03-01", "yield": 95},
            {"date": "2024-03-02", "yield": 92},
            {"date": "2024-03-03", "yield": 98},
            {"date": "2024-03-04", "yield": 94},
            {"date": "2024-03-05", "yield": 96},
            {"date": "2024-03-06", "yield": 93},
            {"date": "2024-03-07", "yield": 97},
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/lookup/{order_number}", response_model=OrderLookupResponse)
async def lookup_order(
    order_number: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Lookup a Purchase Order or Working Order by number.
    Returns order details for QC inspection.
    """
    try:
        return await QCService.lookup_order(order_number)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{inspection_id}", response_model=QCInspectionResponse)
async def get_inspection(
    inspection_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get generic details of a single inspection.
    """
    try:
        return await QCService.get_inspection_by_id(inspection_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{inspection_id}")
async def delete_inspection(
    inspection_id: str,
    current_user: UserResponse = Depends(require_role(["Supervisor", "Worker"])),
    _module_guard: UserResponse = Depends(require_worker_module_access("qc"))
):
    """
    Cancel an existing QC inspection.
    """
    try:
        return await QCService.delete_inspection(inspection_id, current_user.id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
