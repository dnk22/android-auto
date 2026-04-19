from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

import uiautomator2 as u2


class ShopeeBot:
    def __init__(self, *, logger: logging.Logger, timeout_sec: float) -> None:
        self._logger = logger
        self._timeout_sec = timeout_sec
        self._connections: dict[str, Any] = {}

    def _log(self, level: str, event: str, **meta: object) -> None:
        payload = {
            "ts": int(time.time()),
            "service": "automation",
            "component": "shopee_bot",
            "event": event,
            "meta": meta,
        }
        getattr(self._logger, level)(json.dumps(payload, ensure_ascii=True))

    async def _connect(self, device_id: str) -> Any:
        connection = await asyncio.wait_for(
            asyncio.to_thread(u2.connect, device_id),
            timeout=self._timeout_sec,
        )
        self._connections[device_id] = connection
        return connection

    async def run(
        self,
        device_id: str,
        video_path: str,
        products: list[str],
        hashtag: str,
    ) -> None:
        try:
            _ = await self._connect(device_id)
        except Exception as exc:  # noqa: BLE001
            self._log("error", "device_connect_failed", deviceId=device_id, error=str(exc))
            raise RuntimeError("device disconnected") from exc

        self._log(
            "info",
            "run_started",
            deviceId=device_id,
            videoPath=video_path,
            products=products,
            hashtag=hashtag,
        )
        await asyncio.sleep(2)
        self._log("info", "run_finished", deviceId=device_id)

    async def stop_device(self, device_id: str) -> None:
        connection = self._connections.get(device_id)
        if connection is None:
            return

        try:
            await asyncio.to_thread(connection.reset_uiautomator)
        except Exception as exc:  # noqa: BLE001
            self._log("warning", "disconnect_failed", deviceId=device_id, error=str(exc))
        finally:
            self._connections.pop(device_id, None)
