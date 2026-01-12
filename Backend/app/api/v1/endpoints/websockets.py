from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional
import logging
from app.api.deps import get_current_user_ws
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/dashboard")
async def dashboard_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token for authentication")
):
    """
    WebSocket endpoint for real-time dashboard updates.
    
    Clients connect to receive live updates for KPIs, orders, shortages, etc.
    Authentication via query parameter token.
    """
    # Authenticate user
    try:
        current_user = await get_current_user_ws(token)
    except Exception as e:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    await manager.connect(websocket, current_user.id)
    
    try:
        # Send initial dashboard data
        # initial_data = await dashboard_service.get_dashboard_data(current_user["id"], current_user["roles"])
        # await manager.send_personal_message(initial_data.dict(), websocket)
        
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed (e.g., subscribe/unsubscribe)
            logger.info(f"Received message from {current_user['id']}: {data}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user["id"])
        logger.info(f"Client {current_user['id']} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {current_user['id']}: {e}")
        manager.disconnect(websocket, current_user["id"])


@router.websocket("/boms")
async def boms_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token for authentication")
):
    """
    WebSocket endpoint for real-time BOM Planner updates.
    
    Clients connect to receive live updates for BOM changes, material updates, validation results, etc.
    Authentication via query parameter token.
    """
    # Authenticate user
    try:
        current_user = await get_current_user_ws(token)
    except Exception as e:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    await manager.connect(websocket, current_user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed (e.g., subscribe to specific BOM)
            logger.info(f"Received message from {current_user['id']}: {data}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user["id"])
        logger.info(f"Client {current_user['id']} disconnected from BOMs")
    except Exception as e:
        logger.error(f"WebSocket error for {current_user['id']}: {e}")
        manager.disconnect(websocket, current_user["id"])


@router.websocket("/purchase-orders")
async def purchase_orders_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token for authentication")
):
    """
    WebSocket endpoint for real-time Purchase Orders updates.
    
    Clients connect to receive live updates for request status changes, approvals, stock updates, etc.
    Authentication via query parameter token.
    """
    # Authenticate user
    try:
        current_user = await get_current_user_ws(token)
    except Exception as e:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    await manager.connect(websocket, current_user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed (e.g., subscribe to specific requests)
            logger.info(f"Received message from {current_user['id']}: {data}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user["id"])
        logger.info(f"Client {current_user['id']} disconnected from Purchase Orders")
    except Exception as e:
        logger.error(f"WebSocket error for {current_user['id']}: {e}")
        manager.disconnect(websocket, current_user["id"])


@router.websocket("/inventory")
async def inventory_websocket(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT access token for authentication")
):
    """
    WebSocket endpoint for real-time Inventory updates.
    
    Clients connect to receive live updates for stock changes, alerts, allocations, etc.
    Authentication via query parameter token.
    """
    # Authenticate user
    try:
        current_user = await get_current_user_ws(token)
    except Exception as e:
        await websocket.close(code=1008, reason="Authentication failed")
        return

    await manager.connect(websocket, current_user.id)
    
    try:
        while True:
            data = await websocket.receive_text()
            # Handle client messages if needed (e.g., subscribe to specific products/locations)
            logger.info(f"Received message from {current_user['id']}: {data}")
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, current_user["id"])
        logger.info(f"Client {current_user['id']} disconnected from Inventory")
    except Exception as e:
        logger.error(f"WebSocket error for {current_user['id']}: {e}")
        manager.disconnect(websocket, current_user["id"])
