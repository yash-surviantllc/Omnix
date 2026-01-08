from typing import List, Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from app.api.deps import get_current_user, require_role
from app.core.websocket_manager import wip_ws_manager
from app.schemas.user import UserResponse
from app.schemas.wip import (
    BottleneckResponse,
    StageMetricsDetailResponse,
    StageOrdersResponse,
    TrendResponse,
    WIPAlertResponse,
    WIPBoardResponse,
    WIPStageCreate,
    WIPStageResponse,
    WIPStageUpdate,
    WIPTransferCreate,
    WIPTransferResponse,
)
from app.services.wip_board_service import wip_board_service

router = APIRouter()


@router.get("/board", response_model=WIPBoardResponse)
async def get_wip_board(
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.get_board()


@router.get("/stages", response_model=List[WIPStageResponse])
async def list_wip_stages(
    include_inactive: bool = Query(False, description="Set true to include inactive stages"),
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.list_stages(include_inactive=include_inactive)


@router.post("/stages", response_model=WIPStageResponse, status_code=201)
async def create_wip_stage(
    stage_data: WIPStageCreate,
    current_user: UserResponse = Depends(require_role("Admin")),
):
    payload = stage_data.model_copy(update={"created_by": current_user.id})
    return await wip_board_service.create_stage(payload)


@router.put("/stages/{stage_id}", response_model=WIPStageResponse)
async def update_wip_stage(
    stage_id: str,
    stage_data: WIPStageUpdate,
    current_user: UserResponse = Depends(require_role("Admin")),
):
    return await wip_board_service.update_stage(stage_id, stage_data)


@router.delete("/stages/{stage_id}")
async def delete_wip_stage(
    stage_id: str,
    current_user: UserResponse = Depends(require_role("Admin")),
):
    return await wip_board_service.delete_stage(stage_id)


@router.get("/stages/{stage_id}/orders", response_model=StageOrdersResponse)
async def get_stage_orders(
    stage_id: str,
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.get_stage_orders(stage_id)


@router.get("/stages/{stage_id}/metrics", response_model=StageMetricsDetailResponse)
async def get_stage_metrics_detail(
    stage_id: str,
    days: int = Query(14, ge=1, le=90),
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.get_stage_metrics_detail(stage_id, history_days=days)


@router.post("/transfer", response_model=WIPTransferResponse, status_code=201)
async def record_wip_transfer(
    transfer_data: WIPTransferCreate,
    current_user: UserResponse = Depends(require_role("Supervisor")),
):
    return await wip_board_service.record_transfer(transfer_data, current_user.id)


@router.get("/bottlenecks", response_model=List[BottleneckResponse])
async def list_bottlenecks(
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.list_bottlenecks()


@router.get("/trends", response_model=List[TrendResponse])
async def list_trends(
    stage_id: Optional[str] = Query(None, description="Filter by stage ID"),
    days: int = Query(14, ge=1, le=90),
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.list_trends(stage_id=stage_id, days=days)


@router.get("/alerts", response_model=List[WIPAlertResponse])
async def list_wip_alerts(
    current_user: UserResponse = Depends(get_current_user),
):
    return await wip_board_service.list_alerts()


@router.websocket("/ws")
async def wip_board_websocket(websocket: WebSocket):
    await wip_ws_manager.connect(websocket)
    try:
        while True:
            # keep the connection alive; clients primarily receive broadcasts
            await websocket.receive_text()
    except WebSocketDisconnect:
        await wip_ws_manager.disconnect(websocket)
