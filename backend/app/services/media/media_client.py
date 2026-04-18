from __future__ import annotations

from typing import Any

import httpx

from app.core.config import Settings
from app.models.api import StreamStatusPayload
from app.utils.retry import with_retry


class MediaClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client = httpx.AsyncClient(timeout=settings.media_request_timeout_sec)

    async def close(self) -> None:
        await self._client.aclose()

    @with_retry(retries=2, delay_sec=0.25, retry_for=(httpx.HTTPError,))
    async def start_stream(self, device_id: str, node: str) -> None:
        await self._post(node, "/start-stream", {"deviceId": device_id})

    @with_retry(retries=2, delay_sec=0.25, retry_for=(httpx.HTTPError,))
    async def stop_stream(self, device_id: str, node: str) -> None:
        await self._post(node, "/stop-stream", {"deviceId": device_id})

    @with_retry(retries=2, delay_sec=0.25, retry_for=(httpx.HTTPError,))
    async def restart_stream(self, device_id: str, node: str) -> None:
        await self._post(node, "/restart-stream", {"deviceId": device_id})

    @with_retry(retries=2, delay_sec=0.25, retry_for=(httpx.HTTPError,))
    async def stream_status(self, device_id: str, node: str) -> StreamStatusPayload:
        response = await self._client.get(f"{node}/stream-status", params={"deviceId": device_id})
        response.raise_for_status()
        payload = response.json()
        return StreamStatusPayload.model_validate(payload)

    def stream_ws_url(self, device_id: str, node: str) -> str:
        if self._settings.media_ws_base:
            base = self._settings.media_ws_base.rstrip("/")

            if base.startswith("/"):
                return f"{base}/stream/{device_id}"

            return f"{base}/stream/{device_id}"
        ws_base = node.replace("http://", "ws://").replace("https://", "wss://")
        return f"{ws_base.rstrip('/')}/stream/{device_id}"

    async def _post(self, node: str, path: str, payload: dict[str, Any]) -> None:
        response = await self._client.post(f"{node}{path}", json=payload)
        response.raise_for_status()
