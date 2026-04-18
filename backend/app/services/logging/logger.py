from __future__ import annotations

import asyncio
import sys
from collections.abc import Awaitable, Callable

from app.models.common import LogLevel, LogRecord, LogType


LogSink = Callable[[str], Awaitable[None]]


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

    def _emit(self, record: LogRecord) -> None:
        line = record.model_dump_json()
        sys.stdout.write(line + "\n")

        if self._sink is None:
            return

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return

        task = loop.create_task(self._sink(line))
        task.add_done_callback(_drain_task)

    def info(
        self,
        *,
        device_id: str | None,
        type: LogType,
        event: str,
        message: str,
        meta: dict[str, object] | None = None,
    ) -> None:
        self._emit(
            LogRecord(
                level=LogLevel.INFO,
                type=type,
                event=event,
                message=message,
                device_id=device_id,
                meta=meta or {},
            )
        )

    def warning(
        self,
        *,
        device_id: str | None,
        type: LogType,
        event: str,
        message: str,
        meta: dict[str, object] | None = None,
    ) -> None:
        self._emit(
            LogRecord(
                level=LogLevel.WARNING,
                type=type,
                event=event,
                message=message,
                device_id=device_id,
                meta=meta or {},
            )
        )

    def error(
        self,
        *,
        device_id: str | None,
        type: LogType,
        event: str,
        message: str,
        meta: dict[str, object] | None = None,
    ) -> None:
        self._emit(
            LogRecord(
                level=LogLevel.ERROR,
                type=type,
                event=event,
                message=message,
                device_id=device_id,
                meta=meta or {},
            )
        )

    def success(
        self,
        *,
        device_id: str | None,
        type: LogType,
        event: str,
        message: str,
        meta: dict[str, object] | None = None,
    ) -> None:
        self._emit(
            LogRecord(
                level=LogLevel.SUCCESS,
                type=type,
                event=event,
                message=message,
                device_id=device_id,
                meta=meta or {},
            )
        )
