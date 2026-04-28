from __future__ import annotations

import asyncio
import sys
from typing import Any
from collections.abc import Awaitable, Callable

from app.models.common import SystemLogEvent, SystemLogWsMessage, normalize_component, normalize_log_level


LogSinkMessage = dict[str, Any] | str
LogSink = Callable[[LogSinkMessage], Awaitable[None]]


def _drain_task(task: asyncio.Task[None]) -> None:
    try:
        _ = task.exception()
    except asyncio.CancelledError:
        return


class JsonLogger:
    def __init__(self) -> None:
        self._sink: LogSink | None = None

    def set_sink(self, sink: LogSink) -> None:
        self._sink = sink

    def _emit(self, level: str, *args: object, **kwargs: object) -> dict[str, Any]:
        if args:
            first = args[0]
            if isinstance(first, str) and "message" not in kwargs:
                kwargs["message"] = first
                kwargs.setdefault("event", "log")
            elif isinstance(first, dict):
                merged = dict(first)
                merged.update(kwargs)
                kwargs = merged

        component_raw = kwargs.pop("component", None) or kwargs.pop("type", None)
        event = str(kwargs.pop("event", "log") or "log")
        message = str(kwargs.pop("message", event) or event)
        device_id = kwargs.pop("deviceId", None) or kwargs.pop("device_id", None)
        meta_value = kwargs.pop("meta", None)

        meta: dict[str, Any]
        if isinstance(meta_value, dict):
            meta = dict(meta_value)
        elif meta_value is None:
            meta = {}
        else:
            meta = {"meta": meta_value}

        if kwargs:
            meta.update(kwargs)

        payload = SystemLogEvent(
            service="orchestrator",
            component=normalize_component(str(component_raw) if component_raw is not None else None),
            level=normalize_log_level(level),
            event=event,
            message=message,
            deviceId=str(device_id) if device_id is not None else None,
            meta=meta,
        )
        ws_message = SystemLogWsMessage(payload=payload).model_dump(mode="json")
        line = SystemLogWsMessage(payload=payload).model_dump_json()
        sys.stdout.write(line + "\n")

        if self._sink is None:
            return ws_message

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return ws_message

        task = loop.create_task(self._sink(ws_message))
        task.add_done_callback(_drain_task)
        return ws_message

    def debug(self, *args: object, **kwargs: object) -> dict[str, Any]:
        return self._emit("debug", *args, **kwargs)

    def info(self, *args: object, **kwargs: object) -> dict[str, Any]:
        return self._emit("info", *args, **kwargs)

    def warning(self, *args: object, **kwargs: object) -> dict[str, Any]:
        return self._emit("warning", *args, **kwargs)

    def error(self, *args: object, **kwargs: object) -> dict[str, Any]:
        return self._emit("error", *args, **kwargs)

    def success(self, *args: object, **kwargs: object) -> dict[str, Any]:
        return self._emit("success", *args, **kwargs)
