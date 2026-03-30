from fastapi import APIRouter, Depends, Query
from typing import List
from app.api.deps import get_current_user, require_role, require_worker_module_access
from app.schemas.user import UserResponse
from app.schemas.gate_exit import GateExitCreate, GateExitResponse, GateExitStats
from app.services.gate_exit_service import gate_exit_service

router = APIRouter()

@router.post("/", response_model=GateExitResponse, status_code=201)
async def create_exit(
    data: GateExitCreate,
    current_user: UserResponse = Depends(require_role(["Supervisor", "Worker"])),
    _module_guard: UserResponse = Depends(require_worker_module_access("gate-exit"))
):
    """
    Create a new Gate Exit record.
    """
    return await gate_exit_service.create_exit(data, current_user.id)

@router.get("/", response_model=List[GateExitResponse])
async def list_exits(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    List Gate Exit records.
    """
    return await gate_exit_service.list_exits(limit, offset)

@router.get("/stats", response_model=GateExitStats)
async def get_stats(
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get Gate Exit statistics.
    """
    return await gate_exit_service.get_stats()

@router.get("/{exit_id}", response_model=GateExitResponse)
async def get_exit(
    exit_id: str,
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Get generic Gate Exit details.
    """
    return await gate_exit_service.get_exit_by_id(exit_id)
