from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager


class DeviceLocks:
    def __init__(self) -> None:
        self._locks: dict[str, asyncio.Lock] = {}
        self._guard = asyncio.Lock()

    async def _get_lock(self, device_id: str) -> asyncio.Lock:
        async with self._guard:
            lock = self._locks.get(device_id)
            if lock is None:
                lock = asyncio.Lock()
                self._locks[device_id] = lock
            return lock

    @asynccontextmanager
    async def device(self, device_id: str):
        lock = await self._get_lock(device_id)
        async with lock:
            yield
