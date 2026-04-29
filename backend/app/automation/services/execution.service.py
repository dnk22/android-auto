from __future__ import annotations

import json
import sqlite3
import time
from pathlib import Path
from uuid import uuid4

from app.automation.constants.automation_constants import ExecutionStatus, SheetStatus
from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger
from app.automation.models.job_execution_model import JobExecution
from app.automation.models.sheet_model import SheetRow


class ExecutionService:
    def __init__(self, *, db_path: Path, logger: AutomationSystemLogger) -> None:
        self._db_path = db_path
        self._logger = logger

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def create_execution_from_ready_job(self, video_id: str) -> tuple[SheetRow | None, JobExecution | None]:
        timestamp = int(time.time())
        execution_id = uuid4().hex
        with self._connect() as connection:
            try:
                connection.execute("BEGIN IMMEDIATE")
                job_row = connection.execute(
                    """
                    SELECT
                        j.id,
                        j.video_id,
                        v.video_name,
                        COALESCE(j.device_id, '') AS device_id,
                        COALESCE(j.products, '') AS products,
                        j.hashtag_inline,
                        j.hashtag_common,
                        j.created_by_duplicate,
                        j.status,
                        j.meta,
                        j.version,
                        j.started_at,
                        j.finished_at,
                        j.created_at,
                        j.updated_at
                    FROM sheets j
                    JOIN videos v ON v.id = j.video_id
                    WHERE j.video_id = ?
                    """,
                    (video_id,),
                ).fetchone()
                if job_row is None or str(job_row["status"]) != SheetStatus.READY:
                    connection.rollback()
                    return None, None

                next_attempt_row = connection.execute(
                    """
                    SELECT COALESCE(MAX(attempt_no), 0) + 1 AS attempt_no
                    FROM job_executions
                    WHERE job_id = ?
                    """,
                    (str(job_row["id"]),),
                ).fetchone()
                next_attempt = int(next_attempt_row["attempt_no"]) if next_attempt_row else 1

                connection.execute(
                    """
                    INSERT INTO job_executions (
                        id,
                        job_id,
                        video_id,
                        video_name,
                        scenario_name,
                        requested_device,
                        assigned_device,
                        status,
                        attempt_no,
                        priority,
                        started_at,
                        finished_at,
                        error_message,
                        result_meta,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, NULL, NULL, NULL, NULL, ?, ?)
                    """,
                    (
                        execution_id,
                        str(job_row["id"]),
                        str(job_row["video_id"]),
                        str(job_row["video_name"]),
                        "upload_shopee_video",
                        str(job_row["device_id"] or ""),
                        ExecutionStatus.PENDING,
                        next_attempt,
                        timestamp,
                        timestamp,
                    ),
                )

                raw_meta = job_row["meta"]
                meta_payload: dict[str, object] = {}
                if isinstance(raw_meta, str) and raw_meta.strip():
                    try:
                        decoded = json.loads(raw_meta)
                        if isinstance(decoded, dict):
                            meta_payload = decoded
                    except json.JSONDecodeError:
                        meta_payload = {"rawMeta": raw_meta}
                meta_payload["executionId"] = execution_id

                updated = connection.execute(
                    """
                    UPDATE sheets
                    SET
                        status = ?,
                        meta = ?,
                        updated_at = ?,
                        version = version + 1
                    WHERE video_id = ? AND status = ?
                    """,
                    (
                        SheetStatus.QUEUED,
                        json.dumps(meta_payload, ensure_ascii=True),
                        timestamp,
                        video_id,
                        SheetStatus.READY,
                    ),
                )
                if updated.rowcount != 1:
                    raise RuntimeError("failed to mark ready row as queued")

                updated_row = connection.execute(
                    """
                    SELECT
                        j.id,
                        v.id AS video_id,
                        v.video_name,
                        COALESCE(j.device_id, '') AS device_id,
                        COALESCE(j.products, '') AS products,
                        j.hashtag_inline,
                        j.hashtag_common,
                        j.created_by_duplicate,
                        j.status,
                        j.meta,
                        j.version,
                        j.started_at,
                        j.finished_at,
                        j.created_at,
                        j.updated_at
                    FROM sheets j
                    JOIN videos v ON v.id = j.video_id
                    WHERE j.video_id = ?
                    """,
                    (video_id,),
                ).fetchone()

                execution_row = connection.execute(
                    "SELECT * FROM job_executions WHERE id = ?",
                    (execution_id,),
                ).fetchone()
                connection.commit()
            except sqlite3.IntegrityError:
                connection.rollback()
                self._logger.warning(
                    component=AutomationLogComponent.EXECUTION,
                    event="execution_create_failed",
                    message="Failed to create execution due to integrity error",
                    meta={"videoId": video_id},
                )
                return None, None
            except Exception:
                connection.rollback()
                raise

        if updated_row is None or execution_row is None:
            return None, None
        execution = self._execution_from_db(execution_row)
        row = self._sheet_row_from_db(updated_row)
        self._logger.success(
            component=AutomationLogComponent.EXECUTION,
            event="execution_created",
            message="Created pending execution",
            meta={
                "executionId": execution.id,
                "jobId": execution.jobId,
                "videoId": execution.videoId,
                "attemptNo": execution.attemptNo,
                "status": execution.status,
            },
        )
        return row, execution

    def get_pending_executions(self, *, limit: int = 20) -> list[JobExecution]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT *
                FROM job_executions
                WHERE status = ?
                ORDER BY created_at ASC
                LIMIT ?
                """,
                (ExecutionStatus.PENDING, limit),
            ).fetchall()
        return [self._execution_from_db(row) for row in rows]

    def get_by_id(self, execution_id: str) -> JobExecution | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM job_executions WHERE id = ?",
                (execution_id,),
            ).fetchone()
        return self._execution_from_db(row) if row else None

    def update_execution_status(
        self,
        execution_id: str,
        status: str,
        *,
        expected_statuses: set[str] | None = None,
        assigned_device: str | None = None,
        error_message: str | None = None,
        result_meta: str | None = None,
    ) -> JobExecution | None:
        timestamp = int(time.time())
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM job_executions WHERE id = ?",
                (execution_id,),
            ).fetchone()
            if row is None:
                return None
            current_status = str(row["status"])
            if expected_statuses is not None and current_status not in expected_statuses:
                return None

            started_at = row["started_at"]
            finished_at = row["finished_at"]
            if status == ExecutionStatus.RUNNING and started_at is None:
                started_at = timestamp
            if status in {ExecutionStatus.DONE, ExecutionStatus.ERROR, ExecutionStatus.STOPPED}:
                finished_at = timestamp

            connection.execute(
                """
                UPDATE job_executions
                SET
                    status = ?,
                    assigned_device = COALESCE(?, assigned_device),
                    started_at = ?,
                    finished_at = ?,
                    error_message = COALESCE(?, error_message),
                    result_meta = COALESCE(?, result_meta),
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    status,
                    assigned_device,
                    started_at,
                    finished_at,
                    error_message,
                    result_meta,
                    timestamp,
                    execution_id,
                ),
            )
            connection.commit()
            updated = connection.execute(
                "SELECT * FROM job_executions WHERE id = ?",
                (execution_id,),
            ).fetchone()
        return self._execution_from_db(updated) if updated else None

    def mark_assigned(self, execution_id: str, assigned_device: str) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.ASSIGNED,
            expected_statuses={ExecutionStatus.PENDING},
            assigned_device=assigned_device,
        )

    def mark_running(self, execution_id: str) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.RUNNING,
            expected_statuses={ExecutionStatus.ASSIGNED},
        )

    def mark_paused(self, execution_id: str, *, error_message: str | None = None) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.PAUSED,
            expected_statuses={ExecutionStatus.RUNNING},
            error_message=error_message,
        )

    def mark_done(self, execution_id: str, *, result_meta: str | None = None) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.DONE,
            expected_statuses={ExecutionStatus.RUNNING},
            result_meta=result_meta,
        )

    def mark_error(self, execution_id: str, error_message: str) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.ERROR,
            expected_statuses={
                ExecutionStatus.PENDING,
                ExecutionStatus.ASSIGNED,
                ExecutionStatus.RUNNING,
                ExecutionStatus.PAUSED,
            },
            error_message=error_message,
        )

    def mark_stopped(self, execution_id: str) -> JobExecution | None:
        return self.update_execution_status(
            execution_id,
            ExecutionStatus.STOPPED,
            expected_statuses={
                ExecutionStatus.PENDING,
                ExecutionStatus.ASSIGNED,
                ExecutionStatus.RUNNING,
                ExecutionStatus.PAUSED,
            },
        )

    def get_latest_execution_by_job_id(self, job_id: str) -> JobExecution | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM job_executions
                WHERE job_id = ?
                ORDER BY attempt_no DESC, created_at DESC
                LIMIT 1
                """,
                (job_id,),
            ).fetchone()
        return self._execution_from_db(row) if row else None

    def get_active_by_video_id(self, video_id: str) -> JobExecution | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM job_executions
                WHERE video_id = ?
                  AND status IN (?, ?, ?, ?)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (
                    video_id,
                    ExecutionStatus.PENDING,
                    ExecutionStatus.ASSIGNED,
                    ExecutionStatus.RUNNING,
                    ExecutionStatus.PAUSED,
                ),
            ).fetchone()
        return self._execution_from_db(row) if row else None

    def get_active_by_job_id(self, job_id: str) -> JobExecution | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT *
                FROM job_executions
                WHERE job_id = ?
                  AND status IN (?, ?, ?, ?)
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (
                    job_id,
                    ExecutionStatus.PENDING,
                    ExecutionStatus.ASSIGNED,
                    ExecutionStatus.RUNNING,
                    ExecutionStatus.PAUSED,
                ),
            ).fetchone()
        return self._execution_from_db(row) if row else None

    def _execution_from_db(self, row: sqlite3.Row) -> JobExecution:
        return JobExecution(
            id=str(row["id"]),
            jobId=str(row["job_id"]),
            videoId=str(row["video_id"]),
            videoName=row["video_name"],
            scenarioName=str(row["scenario_name"]),
            requestedDevice=row["requested_device"],
            assignedDevice=row["assigned_device"],
            status=str(row["status"]),
            attemptNo=int(row["attempt_no"]),
            priority=int(row["priority"] or 0),
            startedAt=row["started_at"],
            finishedAt=row["finished_at"],
            errorMessage=row["error_message"],
            resultMeta=row["result_meta"],
            createdAt=int(row["created_at"]),
            updatedAt=int(row["updated_at"]),
        )

    def _sheet_row_from_db(self, row: sqlite3.Row) -> SheetRow:
        return SheetRow(
            id=str(row["id"]),
            videoId=str(row["video_id"]),
            videoName=str(row["video_name"]),
            deviceId=str(row["device_id"] or ""),
            products=str(row["products"] or ""),
            hashtagInline=row["hashtag_inline"],
            hashtagCommon=row["hashtag_common"],
            createdByDuplicate=bool(row["created_by_duplicate"]),
            status=str(row["status"]),
            meta=row["meta"],
            version=int(row["version"] or 0),
            startedAt=row["started_at"],
            finishedAt=row["finished_at"],
            createdAt=int(row["created_at"]),
            updatedAt=int(row["updated_at"]),
        )
