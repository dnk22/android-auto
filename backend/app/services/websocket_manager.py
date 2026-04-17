import asyncio
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    def __init__(self) -> None:
        self.connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.connections.discard(websocket)

    async def broadcast(self, payload: Any) -> None:
        async with self._lock:
            targets = list(self.connections)

        stale: list[WebSocket] = []
        for websocket in targets:
            try:
                if isinstance(payload, (dict, list)):
                    await websocket.send_json(payload)
                else:
                    await websocket.send_text(str(payload))
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self.connections.discard(websocket)
