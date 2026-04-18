from __future__ import annotations

import asyncio
from collections.abc import Iterable

from fastapi import WebSocket

from app.core.events import DeviceUpdateEvent


class WSManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._log_connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def connect_logs(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._log_connections.add(websocket)

    async def disconnect_logs(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._log_connections.discard(websocket)

    async def broadcast(self, event: DeviceUpdateEvent) -> None:
        stale: list[WebSocket] = []
        payload = event.model_dump(mode="json")

        async with self._lock:
            targets: Iterable[WebSocket] = tuple(self._connections)

        for websocket in targets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self._connections.discard(websocket)

    async def broadcast_log(self, message: str) -> None:
        stale: list[WebSocket] = []

        async with self._lock:
            targets: Iterable[WebSocket] = tuple(self._log_connections)

        for websocket in targets:
            try:
                await websocket.send_text(message)
            except Exception:
                stale.append(websocket)

        if stale:
            async with self._lock:
                for websocket in stale:
                    self._log_connections.discard(websocket)
