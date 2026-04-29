from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from app.automation.constants.automation_constants import ExecutionLogLevel


class ExecutionLogService:
    def __init__(self, *, db_path: Path, event_service) -> None:
        self._db_path = db_path
        self._event_service = event_service

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    async def add_log(
        self,
        *,
        execution_id: str,
        level: str,
        event: str,
        message: str,
        job_id: str | None = None,
        video_id: str | None = None,
        device_id: str | None = None,
        step_id: int | None = None,
        step_index: int | None = None,
        step_key: str | None = None,
        step_name: str | None = None,
        source: str | None = None,
        component: str | None = None,
        reason: str | None = None,
        meta: dict[str, Any] | None = None,
        screenshot_path: str | None = None,
    ) -> dict[str, Any]:
        row = await asyncio.to_thread(
            self._insert_log_sync,
            execution_id,
            level,
            event,
            message,
            job_id,
            video_id,
            device_id,
            step_id,
            step_index,
            step_key,
            step_name,
            source,
            component,
            reason,
            meta,
            screenshot_path,
        )
        await self._event_service.emit_event("auto_log_added", row)
        return row

    async def debug(self, **kwargs) -> dict[str, Any]:
        return await self.add_log(level=ExecutionLogLevel.DEBUG, **kwargs)

    async def info(self, **kwargs) -> dict[str, Any]:
        return await self.add_log(level=ExecutionLogLevel.INFO, **kwargs)

    async def success(self, **kwargs) -> dict[str, Any]:
        return await self.add_log(level=ExecutionLogLevel.SUCCESS, **kwargs)

    async def warning(self, **kwargs) -> dict[str, Any]:
        return await self.add_log(level=ExecutionLogLevel.WARNING, **kwargs)

    async def error(self, **kwargs) -> dict[str, Any]:
        return await self.add_log(level=ExecutionLogLevel.ERROR, **kwargs)

    async def get_logs_by_execution(
        self,
        execution_id: str,
        *,
        level: str | None = None,
        device_id: str | None = None,
        step_key: str | None = None,
        limit: int = 500,
    ) -> list[dict[str, Any]]:
        return await asyncio.to_thread(
            self._get_logs_by_execution_sync,
            execution_id,
            level,
            device_id,
            step_key,
            limit,
        )

    def _insert_log_sync(
        self,
        execution_id: str,
        level: str,
        event: str,
        message: str,
        job_id: str | None,
        video_id: str | None,
        device_id: str | None,
        step_id: int | None,
        step_index: int | None,
        step_key: str | None,
        step_name: str | None,
        source: str | None,
        component: str | None,
        reason: str | None,
        meta: dict[str, Any] | None,
        screenshot_path: str | None,
    ) -> dict[str, Any]:
        timestamp = int(time.time() * 1000)
        with self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO execution_logs (
                    execution_id,
                    step_id,
                    job_id,
                    video_id,
                    device_id,
                    level,
                    event,
                    message,
                    step_index,
                    step_key,
                    step_name,
                    source,
                    component,
                    reason,
                    meta,
                    screenshot_path,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    execution_id,
                    step_id,
                    job_id,
                    video_id,
                    device_id,
                    level,
                    event,
                    message,
                    step_index,
                    step_key,
                    step_name,
                    source,
                    component,
                    reason,
                    json.dumps(meta, ensure_ascii=True) if meta is not None else None,
                    screenshot_path,
                    timestamp,
                ),
            )
            log_id = int(cursor.lastrowid)
            connection.commit()
            row = connection.execute(
                "SELECT * FROM execution_logs WHERE id = ?",
                (log_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError("failed to fetch inserted execution log")
        return self._row_to_dict(row)

    def _get_logs_by_execution_sync(
        self,
        execution_id: str,
        level: str | None,
        device_id: str | None,
        step_key: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        query = """
            SELECT *
            FROM execution_logs
            WHERE execution_id = ?
        """
        params: list[Any] = [execution_id]
        if level:
            query += " AND level = ?"
            params.append(level)
        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)
        if step_key:
            query += " AND step_key = ?"
            params.append(step_key)
        query += " ORDER BY created_at ASC LIMIT ?"
        params.append(limit)
        with self._connect() as connection:
            rows = connection.execute(query, tuple(params)).fetchall()
        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        meta: dict[str, Any] = {}
        raw_meta = row["meta"]
        if isinstance(raw_meta, str) and raw_meta.strip():
            try:
                parsed = json.loads(raw_meta)
                if isinstance(parsed, dict):
                    meta = parsed
            except json.JSONDecodeError:
                meta = {"rawMeta": raw_meta}
        return {
            "id": int(row["id"]),
            "executionId": str(row["execution_id"]),
            "stepId": row["step_id"],
            "jobId": row["job_id"],
            "videoId": row["video_id"],
            "deviceId": row["device_id"],
            "level": str(row["level"]),
            "event": str(row["event"]),
            "message": str(row["message"]),
            "stepIndex": row["step_index"],
            "stepKey": row["step_key"],
            "stepName": row["step_name"],
            "source": row["source"],
            "component": row["component"],
            "reason": row["reason"],
            "meta": meta,
            "screenshotPath": row["screenshot_path"],
            "createdAt": int(row["created_at"]),
        }
