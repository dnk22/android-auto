from __future__ import annotations

import asyncio
import json
import sys
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from app.models.common import SystemLogEvent, SystemLogWsMessage, normalize_component, normalize_log_level


LogSink = Callable[[dict[str, Any]], Awaitable[None]]


class AutomationLogComponent:
    WATCHER = "watcher"
    SHEET = "sheet"
    STORAGE = "storage"
    EXECUTION = "execution"
    EXECUTION_DISPATCHER = "execution_dispatcher"
    JOB_QUEUE = "job_queue"
    SHOPEE_BOT = "shopee_bot"


class AutomationSystemLogger:
    def __init__(self, sink: LogSink | None = None) -> None:
        self._sink = sink
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_sink(self, sink: LogSink | None) -> None:
        self._sink = sink

    def set_loop(self, loop: asyncio.AbstractEventLoop | None) -> None:
        self._loop = loop

    def debug(
        self,
        *,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        return self._emit("debug", component, event, message, device_id, deviceId, meta, raw)

    def info(
        self,
        *,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        return self._emit("info", component, event, message, device_id, deviceId, meta, raw)

    def success(
        self,
        *,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        return self._emit("success", component, event, message, device_id, deviceId, meta, raw)

    def warning(
        self,
        *,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        return self._emit("warning", component, event, message, device_id, deviceId, meta, raw)

    def error(
        self,
        *,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        return self._emit("error", component, event, message, device_id, deviceId, meta, raw)

    def _emit(
        self,
        level: str,
        component: str,
        event: str,
        message: str,
        device_id: str | None = None,
        deviceId: str | None = None,
        meta: dict[str, Any] | None = None,
        raw: Any | None = None,
    ) -> dict[str, Any]:
        payload = SystemLogEvent(
            id=str(uuid.uuid4()),
            ts=int(time.time() * 1000),
            service="automation",
            component=normalize_component(component),
            level=normalize_log_level(level),
            event=str(event or "automation_log"),
            message=str(message or event or "Automation log"),
            deviceId=deviceId or device_id,
            meta=meta or {},
            raw=raw,
        )
        ws_message = SystemLogWsMessage(payload=payload).model_dump(mode="json")
        sys.stdout.write(SystemLogWsMessage(payload=payload).model_dump_json() + "\n")

        sink = self._sink
        loop = self._loop
        if sink is None or loop is None:
            return ws_message

        def _send() -> None:
            task = loop.create_task(sink(ws_message))
            task.add_done_callback(_drain_task)

        loop.call_soon_threadsafe(_send)
        return ws_message


def _drain_task(task: asyncio.Task[None]) -> None:
    try:
        _ = task.exception()
    except asyncio.CancelledError:
        return
