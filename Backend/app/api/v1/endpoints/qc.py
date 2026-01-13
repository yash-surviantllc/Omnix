from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from app.schemas.qc import (
    QCInspectionCreate, QCInspectionResponse, QCStats
)
from app.services.qc_service import QCService
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=QCInspectionResponse)
async def create_inspection(
    inspection: QCInspectionCreate,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new QC inspection.
    """
    try:
        # Assuming current_user is a dict with 'id' from auth dependency
        user_id = current_user.get("id")
        return await QCService.create_inspection(inspection, user_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/", response_model=List[QCInspectionResponse])
async def list_inspections(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
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
    current_user: dict = Depends(get_current_user)
):
    """
    Get QC Dashboard statistics.
    """
    try:
        return await QCService.get_stats()
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{inspection_id}", response_model=QCInspectionResponse)
async def get_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get generic details of a single inspection.
    """
    try:
        return await QCService.get_inspection_by_id(inspection_id)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))
