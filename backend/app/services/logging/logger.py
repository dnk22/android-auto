from __future__ import annotations

import sys

from app.models.common import LogLevel, LogRecord, LogType


class JsonLogger:
    def _emit(self, record: LogRecord) -> None:
        sys.stdout.write(record.model_dump_json() + "\n")

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
