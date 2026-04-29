from __future__ import annotations

import asyncio
import json
import sqlite3
import time
from pathlib import Path
from typing import Any

from app.automation.constants.automation_constants import (
    ExecutionStepStatus,
    SHOPEE_UPLOAD_STEPS,
)


class ExecutionStepService:
    def __init__(self, *, db_path: Path, event_service) -> None:
        self._db_path = db_path
        self._event_service = event_service

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    async def init_steps_for_execution(
        self,
        execution_id: str,
        scenario_name: str,
        device_id: str | None = None,
    ) -> None:
        steps = SHOPEE_UPLOAD_STEPS if scenario_name == "upload_shopee_video" else ()
        if not steps:
            return
        await asyncio.to_thread(self._init_steps_sync, execution_id, steps, device_id)

    def _init_steps_sync(
        self,
        execution_id: str,
        steps: tuple[dict[str, Any], ...],
        device_id: str | None,
    ) -> None:
        timestamp = int(time.time() * 1000)
        with self._connect() as connection:
            for step in steps:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO execution_steps (
                        execution_id,
                        step_index,
                        step_key,
                        step_name,
                        step_type,
                        status,
                        device_id,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        execution_id,
                        int(step["index"]),
                        str(step["key"]),
                        str(step["name"]),
                        str(step.get("type") or ""),
                        ExecutionStepStatus.PENDING,
                        device_id,
                        timestamp,
                        timestamp,
                    ),
                )
            connection.commit()

    async def get_steps_by_execution(self, execution_id: str) -> list[dict[str, Any]]:
        return await asyncio.to_thread(self._get_steps_by_execution_sync, execution_id)

    def _get_steps_by_execution_sync(self, execution_id: str) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM execution_steps
                WHERE execution_id = ?
                ORDER BY step_index ASC
                """,
                (execution_id,),
            ).fetchall()
        return [self._row_to_dict(row) for row in rows]

    async def mark_step_running(
        self,
        execution_id: str,
        step_key: str,
        device_id: str | None = None,
    ) -> dict[str, Any] | None:
        return await self._mark_step(
            execution_id=execution_id,
            step_key=step_key,
            status=ExecutionStepStatus.RUNNING,
            device_id=device_id,
        )

    async def mark_step_done(
        self,
        execution_id: str,
        step_key: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        return await self._mark_step(
            execution_id=execution_id,
            step_key=step_key,
            status=ExecutionStepStatus.DONE,
            meta=meta,
        )

    async def mark_step_error(
        self,
        execution_id: str,
        step_key: str,
        error_message: str,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        return await self._mark_step(
            execution_id=execution_id,
            step_key=step_key,
            status=ExecutionStepStatus.ERROR,
            error_message=error_message,
            meta=meta,
        )

    async def mark_step_stopped(
        self,
        execution_id: str,
        step_key: str,
        reason: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        combined = {**(meta or {}), "reason": reason} if reason else meta
        return await self._mark_step(
            execution_id=execution_id,
            step_key=step_key,
            status=ExecutionStepStatus.STOPPED,
            meta=combined,
        )

    async def get_current_running_step(self, execution_id: str) -> dict[str, Any] | None:
        return await asyncio.to_thread(self._get_current_running_step_sync, execution_id)

    def _get_current_running_step_sync(self, execution_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM execution_steps
                WHERE execution_id = ? AND status = ?
                ORDER BY step_index DESC
                LIMIT 1
                """,
                (execution_id, ExecutionStepStatus.RUNNING),
            ).fetchone()
        return self._row_to_dict(row) if row else None

    async def _mark_step(
        self,
        *,
        execution_id: str,
        step_key: str,
        status: str,
        device_id: str | None = None,
        error_message: str | None = None,
        meta: dict[str, Any] | None = None,
    ) -> dict[str, Any] | None:
        step = await asyncio.to_thread(
            self._mark_step_sync,
            execution_id,
            step_key,
            status,
            device_id,
            error_message,
            meta,
        )
        if step is not None:
            await self._event_service.emit_event("auto_step_updated", step)
        return step

    def _mark_step_sync(
        self,
        execution_id: str,
        step_key: str,
        status: str,
        device_id: str | None,
        error_message: str | None,
        meta: dict[str, Any] | None,
    ) -> dict[str, Any] | None:
        timestamp = int(time.time() * 1000)
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM execution_steps
                WHERE execution_id = ? AND step_key = ?
                LIMIT 1
                """,
                (execution_id, step_key),
            ).fetchone()
            if row is None:
                return None
            started_at = row["started_at"]
            finished_at = row["finished_at"]
            if status == ExecutionStepStatus.RUNNING and started_at is None:
                started_at = timestamp
            if status in {ExecutionStepStatus.DONE, ExecutionStepStatus.ERROR, ExecutionStepStatus.STOPPED}:
                finished_at = timestamp
            duration_ms = None
            if started_at is not None and finished_at is not None:
                duration_ms = int(finished_at) - int(started_at)
            connection.execute(
                """
                UPDATE execution_steps
                SET
                    status = ?,
                    device_id = COALESCE(?, device_id),
                    started_at = COALESCE(?, started_at),
                    finished_at = COALESCE(?, finished_at),
                    duration_ms = ?,
                    error_message = COALESCE(?, error_message),
                    meta = COALESCE(?, meta),
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    device_id,
                    started_at,
                    finished_at,
                    duration_ms,
                    error_message,
                    json.dumps(meta, ensure_ascii=True) if meta is not None else None,
                    timestamp,
                    int(row["id"]),
                ),
            )
            connection.commit()
            updated = connection.execute(
                "SELECT * FROM execution_steps WHERE id = ?",
                (int(row["id"]),),
            ).fetchone()
        return self._row_to_dict(updated) if updated else None

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
            "stepIndex": int(row["step_index"]),
            "stepKey": str(row["step_key"]),
            "stepName": str(row["step_name"]),
            "stepType": row["step_type"],
            "status": str(row["status"]),
            "deviceId": row["device_id"],
            "startedAt": row["started_at"],
            "finishedAt": row["finished_at"],
            "durationMs": row["duration_ms"],
            "errorMessage": row["error_message"],
            "meta": meta,
            "createdAt": int(row["created_at"]),
            "updatedAt": int(row["updated_at"]),
        }
