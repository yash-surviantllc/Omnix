from typing import Dict, List
from fastapi import WebSocket
import json
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time dashboard updates.
    """

    def __init__(self):
        # active_connections: Dict[user_id, List[WebSocket]]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Add a new WebSocket connection for a user.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"User {user_id} connected. Total connections: {sum(len(conns) for conns in self.active_connections.values())}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        """
        Remove a WebSocket connection for a user.
        """
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"User {user_id} disconnected. Total connections: {sum(len(conns) for conns in self.active_connections.values())}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send a message to a specific WebSocket connection.
        """
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.error(f"Failed to send message: {e}")

    async def broadcast(self, message: dict, user_id: str = None):
        """
        Broadcast a message to all connected WebSockets.
        If user_id is provided, broadcast only to that user's connections.
        """
        if user_id:
            # Broadcast to specific user
            if user_id in self.active_connections:
                for connection in self.active_connections[user_id]:
                    await self.send_personal_message(message, connection)
        else:
            # Broadcast to all users
            for user_connections in self.active_connections.values():
                for connection in user_connections:
                    await self.send_personal_message(message, connection)

    async def broadcast_dashboard_update(self, update_type: str, data: dict):
        """
        Broadcast dashboard updates with type and data.
        Types: 'kpis', 'orders', 'shortages', 'rework', 'activities'
        """
        message = {
            "type": "dashboard_update",
            "update_type": update_type,
            "data": data,
            "timestamp": str(datetime.utcnow())
        }
        await self.broadcast(message)
        logger.info(f"Broadcasted dashboard update: {update_type}")

    def get_connection_count(self) -> int:
        """
        Get total number of active connections.
        """
        return sum(len(conns) for conns in self.active_connections.values())


# Global manager instance
manager = ConnectionManager()
