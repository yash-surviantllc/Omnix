from typing import List
from fastapi import APIRouter, HTTPException
from app.schemas.shifts import ShiftCreate, ShiftUpdate, ShiftResponse
from app.services.shift_service import ShiftService

router = APIRouter()

@router.get("/", response_model=List[ShiftResponse])
async def list_shifts():
    """List all configured shifts."""
    return await ShiftService.list_shifts()

@router.post("/", response_model=ShiftResponse)
async def create_shift(shift: ShiftCreate):
    """Create a new shift configuration."""
    try:
        return await ShiftService.create_shift(shift)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{shift_id}", response_model=ShiftResponse)
async def update_shift(shift_id: str, shift: ShiftUpdate):
    """Update a shift configuration."""
    try:
        return await ShiftService.update_shift(shift_id, shift)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{shift_id}")
async def delete_shift(shift_id: str):
    """Delete a shift configuration."""
    try:
        return await ShiftService.delete_shift(shift_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
