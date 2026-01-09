import asyncio
from typing import Any, Dict, List

from fastapi import WebSocket


class WIPWebSocketManager:
    """Simple WebSocket manager to broadcast WIP board events."""

    def __init__(self) -> None:
        self._connections: List[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.append(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            if websocket in self._connections:
                self._connections.remove(websocket)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        message = payload
        async with self._lock:
            targets = list(self._connections)

        for connection in targets:
            try:
                await connection.send_json(message)
            except Exception:
                await self.disconnect(connection)


wip_ws_manager = WIPWebSocketManager()
