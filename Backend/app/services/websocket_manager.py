from typing import Dict, List
from fastapi import WebSocket
import json
import logging
from datetime import datetime
from collections import defaultdict
import time

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time dashboard updates.
    """

    def __init__(self):
        # active_connections: Dict[user_id, List[WebSocket]]
        self.active_connections: Dict[str, List[WebSocket]] = {}
        # Metrics
        self.connection_metrics = {
            "total_connections": 0,
            "active_connections": 0,
            "messages_sent": 0,
            "messages_received": 0,
            "errors": 0,
            "start_time": time.time()
        }
        self.user_connection_times = defaultdict(list)

    async def connect(self, websocket: WebSocket, user_id: str):
        """
        Add a new WebSocket connection for a user.
        """
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        # Update metrics
        self.connection_metrics["total_connections"] += 1
        self.connection_metrics["active_connections"] = sum(len(conns) for conns in self.active_connections.values())
        self.user_connection_times[user_id].append(time.time())
        logger.info(f"User {user_id} connected. Total connections: {self.connection_metrics['active_connections']}")

    def disconnect(self, websocket: WebSocket, user_id: str):
        """
        Remove a WebSocket connection for a user.
        """
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        # Update metrics
        self.connection_metrics["active_connections"] = sum(len(conns) for conns in self.active_connections.values())
        logger.info(f"User {user_id} disconnected. Total connections: {self.connection_metrics['active_connections']}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """
        Send a message to a specific WebSocket connection.
        """
        try:
            await websocket.send_text(json.dumps(message))
            self.connection_metrics["messages_sent"] += 1
        except Exception as e:
            self.connection_metrics["errors"] += 1
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

    def get_metrics(self) -> dict:
        """
        Get WebSocket connection and message metrics.
        """
        uptime = time.time() - self.connection_metrics["start_time"]
        return {
            **self.connection_metrics,
            "uptime_seconds": uptime,
            "messages_per_second": self.connection_metrics["messages_sent"] / uptime if uptime > 0 else 0,
            "unique_users": len(self.active_connections)
        }


# Global manager instance
manager = ConnectionManager()
