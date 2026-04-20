from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
import time
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.automation.models.job_model import AutomationJob
from app.automation.models.sheet_model import SessionState, SheetRow, SheetState
from app.automation.schemas.automation_schema import UpdateSheetRowRequest
from app.automation.utils.validator import validate_row


class StorageServiceProtocol(Protocol):
    async def has_file(self, video_name: str) -> bool: ...


class JobQueueServiceProtocol(Protocol):
    async def enqueue(self, video_id: str, device_id: str) -> AutomationJob: ...

    async def stop_job_by_video_id(self, video_id: str) -> AutomationJob | None: ...


class SheetService:
    def __init__(
        self,
        *,
        logger: logging.Logger,
        ready_debounce_sec: float,
        storage_path: Path,
    ) -> None:
        self._logger = logger
        self._ready_debounce_sec = ready_debounce_sec
        self._session = SessionState()
        self._debounce_nonce: dict[str, int] = {}
        self._debounce_tasks: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()
        self._db_path = storage_path / "automation.db"
        self._db_ready = False

        self._storage_service: StorageServiceProtocol | None = None
        self._queue_service: JobQueueServiceProtocol | None = None

    async def startup(self) -> None:
        await self._ensure_db_ready()
        async with self._lock:
            repaired = await asyncio.to_thread(self._repair_orphan_sheets_sync)
        if repaired > 0:
            self._log("warning", "orphan_sheets_repaired", repairedCount=repaired)

    async def _ensure_db_ready(self) -> None:
        if self._db_ready:
            return

        async with self._lock:
            if self._db_ready:
                return
            await asyncio.to_thread(self._init_db_sync)
            self._db_ready = True

    def _log(self, level: str, event: str, **meta: object) -> None:
        payload = {
            "ts": int(time.time()),
            "service": "automation",
            "component": "sheet",
            "event": event,
            "meta": meta,
        }
        getattr(self._logger, level)(json.dumps(payload, ensure_ascii=True))

    def bind_dependencies(
        self,
        *,
        storage_service: StorageServiceProtocol,
        queue_service: JobQueueServiceProtocol,
    ) -> None:
        self._storage_service = storage_service
        self._queue_service = queue_service

    async def list_sheet(self) -> SheetState:
        await self._ensure_db_ready()
        async with self._lock:
            rows = await asyncio.to_thread(self._list_rows_sync)
        return SheetState(rows=rows)

    async def get_session(self) -> SessionState:
        async with self._lock:
            return self._session.model_copy(deep=True)

    async def update_session(
        self,
        *,
        status: str | None = None,
        auto_ready: bool | None = None,
        hashtag_common: str | None = None,
        hashtag_common_provided: bool = False,
    ) -> SessionState:
        session_changed = False
        hashtag_common_changed = False
        next_status = status
        if next_status is not None and next_status not in {"watching", "idle"}:
            raise ValueError("invalid session status")

        async with self._lock:
            if next_status is not None and next_status != self._session.status:
                self._session.status = next_status
                session_changed = True
            if auto_ready is not None and auto_ready != self._session.autoReady:
                self._session.autoReady = auto_ready
                session_changed = True
            if hashtag_common_provided:
                next_hashtag_common = self._normalize_optional_text(hashtag_common)
                if next_hashtag_common != self._session.hashtagCommon:
                    self._session.hashtagCommon = next_hashtag_common
                    session_changed = True
                    hashtag_common_changed = True

            session_snapshot = self._session.model_copy(deep=True)

        if hashtag_common_changed:
            await asyncio.to_thread(
                self._set_all_rows_hashtag_common_sync,
                session_snapshot.hashtagCommon,
            )

        if not session_changed:
            return session_snapshot

        if session_snapshot.status == "watching":
            await self._enqueue_ready_jobs()
            return session_snapshot

        if session_snapshot.status == "idle":
            await self._stop_active_jobs_and_reset()
            return session_snapshot

        return session_snapshot

    async def get_row(self, video_id: str) -> SheetRow | None:
        await self._ensure_db_ready()
        async with self._lock:
            return await asyncio.to_thread(self._get_row_by_video_id_sync, video_id)

    async def get_video_name(self, video_id: str) -> str | None:
        row = await self.get_row(video_id)
        return row.videoName if row else None

    async def get_row_by_video_name(self, video_name: str) -> SheetRow | None:
        await self._ensure_db_ready()
        async with self._lock:
            return await asyncio.to_thread(self._get_row_by_video_name_sync, video_name)

    async def has_video_name(self, video_name: str) -> bool:
        await self._ensure_db_ready()
        async with self._lock:
            return await asyncio.to_thread(self._has_video_name_sync, video_name)

    async def upsert_from_storage(self, video_name: str, *, created_by_duplicate: bool) -> SheetRow:
        await self._ensure_db_ready()
        async with self._lock:
            row = await asyncio.to_thread(
                self._upsert_from_storage_sync,
                video_name,
                created_by_duplicate,
            )

        self._log("info", "sheet_row_created", videoId=row.videoId, videoName=row.videoName)
        await self._auto_ready_if_needed(row.videoId)
        return row.model_copy(deep=True)

    async def mark_file_removed(self, video_name: str) -> SheetRow | None:
        await self._ensure_db_ready()
        async with self._lock:
            row = await asyncio.to_thread(self._get_row_by_video_name_sync, video_name)
        if row is None:
            return None

        if row.status == "running" and self._queue_service is not None:
            await self._queue_service.stop_job_by_video_id(row.videoId)

        async with self._lock:
            return await asyncio.to_thread(self._update_status_sync, row.videoId, "missing_file")

    async def rename_video(self, old_name: str, new_name: str) -> SheetRow | None:
        await self._ensure_db_ready()
        async with self._lock:
            return await asyncio.to_thread(self._rename_video_with_missing_revival_sync, old_name, new_name)

    async def assert_can_delete(self, video_name: str) -> None:
        await self._ensure_db_ready()
        async with self._lock:
            row = await asyncio.to_thread(self._get_row_by_video_name_sync, video_name)
        if row is None:
            return
        if row.status == "ready":
            raise ValueError("cannot delete file when row status is ready")

    async def assert_video_idle(self, video_name: str) -> None:
        await self._ensure_db_ready()
        async with self._lock:
            row = await asyncio.to_thread(self._get_row_by_video_name_sync, video_name)
        if row is None:
            raise ValueError("video not found in sheets")
        if row.status != "idle":
            raise ValueError("only idle sheets can be modified")

    async def rename_video_for_external_event(self, old_name: str, new_name: str) -> SheetRow | None:
        await self._ensure_db_ready()
        async with self._lock:
            existing = await asyncio.to_thread(self._get_row_by_video_name_sync, old_name)
            if existing is None:
                return None

            renamed = await asyncio.to_thread(
                self._rename_video_with_missing_revival_sync,
                old_name,
                new_name,
            )
            if renamed is None:
                return None

            if existing.status != "idle":
                renamed = await asyncio.to_thread(self._update_status_sync, renamed.videoId, "stopped")

        return renamed

    def _rename_video_with_missing_revival_sync(self, old_name: str, new_name: str) -> SheetRow | None:
        timestamp = int(time.time())
        with self._connect() as connection:
            source = connection.execute(
                "SELECT id FROM videos WHERE video_name = ?",
                (old_name,),
            ).fetchone()
            if source is None:
                return None

            source_video_id = str(source["id"])

            target = connection.execute(
                """
                SELECT v.id AS video_id, j.status AS status
                FROM videos v
                JOIN sheets j ON j.video_id = v.id
                WHERE v.video_name = ?
                """,
                (new_name,),
            ).fetchone()

            if target is not None:
                target_video_id = str(target["video_id"])
                target_status = str(target["status"])
                if target_status != "missing_file":
                    raise ValueError("target video name already exists")

                # File is effectively moved from old_name -> new_name where new_name row existed
                # as missing_file: mark old row missing and revive target row to idle.
                connection.execute(
                    """
                    UPDATE sheets
                    SET
                        status = 'missing_file',
                        updated_at = ?,
                        version = version + 1
                    WHERE video_id = ?
                    """,
                    (timestamp, source_video_id),
                )
                connection.execute(
                    """
                    UPDATE sheets
                    SET
                        status = 'idle',
                        updated_at = ?,
                        version = version + 1
                    WHERE video_id = ?
                    """,
                    (timestamp, target_video_id),
                )
                connection.commit()
                return self._get_row_by_video_id_sync(target_video_id)

            connection.execute(
                "UPDATE videos SET video_name = ?, updated_at = ? WHERE id = ?",
                (new_name, timestamp, source_video_id),
            )
            connection.execute(
                "UPDATE sheets SET updated_at = ?, version = version + 1 WHERE video_id = ?",
                (timestamp, source_video_id),
            )
            connection.commit()

        return self._get_row_by_video_id_sync(source_video_id)

    async def update_row(self, video_id: str, payload: UpdateSheetRowRequest) -> SheetRow:
        await self._ensure_db_ready()
        async with self._lock:
            updated = await asyncio.to_thread(self._update_row_sync, video_id, payload)

        await self._auto_ready_if_needed(video_id)
        return updated

    async def bulk_update_rows(self, rows: list[SheetRow]) -> list[SheetRow]:
        updated: list[SheetRow] = []
        for row in rows:
            payload = UpdateSheetRowRequest(
                products=row.products,
                deviceId=row.deviceId,
                hashtagInline=row.hashtagInline,
                status=row.status,
                meta=row.meta,
                version=row.version,
                startedAt=row.startedAt,
                finishedAt=row.finishedAt,
            )
            updated.append(await self.update_row(row.videoId, payload))
        return updated

    async def set_ready(self, video_id: str) -> SheetRow:
        await self._ensure_db_ready()
        if self._storage_service is None:
            raise RuntimeError("storage service is not bound")

        async with self._lock:
            row = await asyncio.to_thread(self._get_row_by_video_id_sync, video_id)
            if row is None:
                raise ValueError("row not found")
            if row.status == "running":
                raise ValueError("row is running")

            exists = await self._storage_service.has_file(row.videoName)
            ok, reason = validate_row(row, exists)
            if not ok:
                raise ValueError(reason or "row is invalid")

            updated = await asyncio.to_thread(self._update_status_sync, video_id, "ready")

            nonce = self._debounce_nonce.get(video_id, 0) + 1
            self._debounce_nonce[video_id] = nonce

            old_task = self._debounce_tasks.get(video_id)
            if old_task and not old_task.done():
                old_task.cancel()

            self._debounce_tasks[video_id] = asyncio.create_task(
                self._ready_debounce(video_id, nonce)
            )

        self._log("info", "sheet_ready", videoId=video_id)
        return updated

    async def on_job_status(self, video_id: str, status: str) -> None:
        await self._ensure_db_ready()
        async with self._lock:
            mapped = "idle" if status == "stopped" else status
            await asyncio.to_thread(self._update_status_sync, video_id, mapped)

    async def cancel(self) -> None:
        async with self._lock:
            tasks = list(self._debounce_tasks.values())
            self._debounce_tasks.clear()

        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _auto_ready_if_needed(self, video_id: str) -> None:
        async with self._lock:
            auto_ready = self._session.autoReady
        if not auto_ready:
            return

        try:
            await self.set_ready(video_id)
        except ValueError:
            return

    async def _ready_debounce(self, video_id: str, nonce: int) -> None:
        try:
            await asyncio.sleep(self._ready_debounce_sec)
            if self._queue_service is None:
                return

            async with self._lock:
                if self._debounce_nonce.get(video_id) != nonce:
                    return

                if self._session.status != "watching":
                    return

                row = await asyncio.to_thread(self._get_row_by_video_id_sync, video_id)
                if row is None or row.status != "ready":
                    return
                device_id = row.deviceId

            job = await self._queue_service.enqueue(video_id, device_id)

            async with self._lock:
                await asyncio.to_thread(self._set_meta_job_id_sync, video_id, job.jobId)
                await asyncio.to_thread(self._update_status_sync, video_id, "queued")

            self._log("info", "job_enqueued", videoId=video_id, deviceId=device_id)
        except asyncio.CancelledError:
            return

    async def _enqueue_ready_jobs(self) -> None:
        if self._queue_service is None:
            return

        async with self._lock:
            ready_rows = await asyncio.to_thread(self._list_rows_by_status_sync, "ready")

        for row in ready_rows:
            job = await self._queue_service.enqueue(row.videoId, row.deviceId)
            async with self._lock:
                await asyncio.to_thread(self._set_meta_job_id_sync, row.videoId, job.jobId)
                await asyncio.to_thread(self._update_status_sync, row.videoId, "queued")

    async def _stop_active_jobs_and_reset(self) -> None:
        if self._queue_service is not None:
            rows = await self.list_sheet()
            for row in rows.rows:
                if row.status in {"running", "queued"}:
                    await self._queue_service.stop_job_by_video_id(row.videoId)

        async with self._lock:
            await asyncio.to_thread(self._reset_ready_queued_sync)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._db_path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    def _init_db_sync(self) -> None:
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            # Session state is now in-memory only; remove legacy persisted session tables.
            connection.execute("DROP TABLE IF EXISTS automation_session")
            connection.execute("DROP TABLE IF EXISTS sessions")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS videos (
                    id TEXT PRIMARY KEY,
                    video_name TEXT NOT NULL UNIQUE,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                )
                """
            )
            self._ensure_columns_sync(
                connection,
                "videos",
                {
                    "created_at": "INTEGER NOT NULL DEFAULT 0",
                    "updated_at": "INTEGER NOT NULL DEFAULT 0",
                },
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sheets (
                    id TEXT PRIMARY KEY,
                    video_id TEXT NOT NULL UNIQUE,
                    device_id TEXT,
                    products TEXT,
                    hashtag_inline TEXT,
                    hashtag_common TEXT,
                    created_by_duplicate INTEGER DEFAULT 0,
                    status TEXT NOT NULL,
                    meta TEXT,
                    version INTEGER DEFAULT 0,
                    started_at INTEGER,
                    finished_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY(video_id) REFERENCES videos(id)
                )
                """
            )
            self._ensure_columns_sync(
                connection,
                "sheets",
                {
                    "device_id": "TEXT",
                    "products": "TEXT",
                    "hashtag_inline": "TEXT",
                    "hashtag_common": "TEXT",
                    "created_by_duplicate": "INTEGER DEFAULT 0",
                    "status": "TEXT NOT NULL DEFAULT 'idle'",
                    "meta": "TEXT",
                    "version": "INTEGER DEFAULT 0",
                    "started_at": "INTEGER",
                    "finished_at": "INTEGER",
                    "created_at": "INTEGER NOT NULL DEFAULT 0",
                    "updated_at": "INTEGER NOT NULL DEFAULT 0",
                },
            )

            legacy_jobs_exists = connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'jobs'",
            ).fetchone()
            if legacy_jobs_exists is not None:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO sheets (
                        id,
                        video_id,
                        device_id,
                        products,
                        hashtag_inline,
                        hashtag_common,
                        created_by_duplicate,
                        status,
                        meta,
                        version,
                        started_at,
                        finished_at,
                        created_at,
                        updated_at
                    )
                    SELECT
                        id,
                        video_id,
                        device_id,
                        products,
                        hashtag_inline,
                        NULL,
                        created_by_duplicate,
                        status,
                        meta,
                        version,
                        started_at,
                        finished_at,
                        created_at,
                        updated_at
                    FROM jobs
                    """,
                )
            connection.commit()

    def _repair_orphan_sheets_sync(self) -> int:
        timestamp = int(time.time())
        repaired = 0
        with self._connect() as connection:
            orphan_videos = connection.execute(
                """
                SELECT v.id AS video_id
                FROM videos v
                LEFT JOIN sheets j ON j.video_id = v.id
                WHERE j.id IS NULL
                """
            ).fetchall()

            for row in orphan_videos:
                video_id = str(row["video_id"])
                job_id = uuid4().hex
                connection.execute(
                    """
                    INSERT INTO sheets (
                        id,
                        video_id,
                        device_id,
                        products,
                        hashtag_inline,
                        hashtag_common,
                        created_by_duplicate,
                        status,
                        meta,
                        version,
                        started_at,
                        finished_at,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, '', '', NULL, NULL, 0, 'idle', ?, 0, NULL, NULL, ?, ?)
                    """,
                    (
                        job_id,
                        video_id,
                        json.dumps({"jobId": job_id}, ensure_ascii=True),
                        timestamp,
                        timestamp,
                    ),
                )
                repaired += 1

            if repaired > 0:
                connection.commit()

        return repaired

    def _ensure_columns_sync(
        self,
        connection: sqlite3.Connection,
        table_name: str,
        required_columns: dict[str, str],
    ) -> None:
        existing = {
            str(row["name"])
            for row in connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        }

        for column_name, ddl in required_columns.items():
            if column_name in existing:
                continue
            connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {ddl}")

    def _list_rows_sync(self) -> list[SheetRow]:
        with self._connect() as connection:
            rows = connection.execute(
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
                ORDER BY j.created_at DESC
                """
            ).fetchall()
        return [self._row_from_db(item) for item in rows]

    def _list_rows_by_status_sync(self, status: str) -> list[SheetRow]:
        with self._connect() as connection:
            rows = connection.execute(
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
                WHERE j.status = ?
                ORDER BY j.created_at DESC
                """,
                (status,),
            ).fetchall()
        return [self._row_from_db(item) for item in rows]

    def _get_row_by_video_id_sync(self, video_id: str) -> SheetRow | None:
        with self._connect() as connection:
            row = connection.execute(
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
                WHERE v.id = ?
                """,
                (video_id,),
            ).fetchone()
        return self._row_from_db(row) if row else None

    def _get_row_by_video_name_sync(self, video_name: str) -> SheetRow | None:
        with self._connect() as connection:
            row = connection.execute(
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
                WHERE v.video_name = ?
                """,
                (video_name,),
            ).fetchone()
        return self._row_from_db(row) if row else None

    def _has_video_name_sync(self, video_name: str) -> bool:
        with self._connect() as connection:
            found = connection.execute(
                "SELECT 1 FROM videos WHERE video_name = ?",
                (video_name,),
            ).fetchone()
        return found is not None

    def _upsert_from_storage_sync(self, video_name: str, created_by_duplicate: bool) -> SheetRow:
        timestamp = int(time.time())
        hashtag_common = self._normalize_optional_text(self._session.hashtagCommon)
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT id FROM videos WHERE video_name = ?",
                (video_name,),
            ).fetchone()

            if existing:
                video_id = str(existing["id"])
                has_job = connection.execute(
                    "SELECT id FROM sheets WHERE video_id = ?",
                    (video_id,),
                ).fetchone()
                if has_job is None:
                    # Recover broken state where a video row exists without a matching job row.
                    job_id = uuid4().hex
                    connection.execute(
                        """
                        INSERT INTO sheets (
                            id,
                            video_id,
                            device_id,
                            products,
                            hashtag_inline,
                            hashtag_common,
                            created_by_duplicate,
                            status,
                            meta,
                            version,
                            started_at,
                            finished_at,
                            created_at,
                            updated_at
                        ) VALUES (?, ?, '', '', NULL, ?, ?, 'idle', ?, 0, NULL, NULL, ?, ?)
                        """,
                        (
                            job_id,
                            video_id,
                            hashtag_common,
                            1 if created_by_duplicate else 0,
                            json.dumps({"jobId": job_id}, ensure_ascii=True),
                            timestamp,
                            timestamp,
                        ),
                    )

                connection.execute(
                    """
                    UPDATE sheets
                    SET
                        status = CASE WHEN status = 'missing_file' THEN 'idle' ELSE status END,
                        created_by_duplicate = ?,
                        updated_at = ?,
                        version = version + 1
                    WHERE video_id = ?
                    """,
                    (1 if created_by_duplicate else 0, timestamp, video_id),
                )
                connection.commit()
                row = self._get_row_by_video_id_sync(video_id)
                if row is None:
                    raise RuntimeError("failed to load updated row")
                return row

            base = Path(video_name).stem or "video"
            video_id = base
            while connection.execute("SELECT 1 FROM videos WHERE id = ?", (video_id,)).fetchone():
                video_id = f"{base}_{uuid4().hex[:6]}"

            job_id = uuid4().hex
            connection.execute(
                """
                INSERT INTO videos (id, video_name, created_at, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (video_id, video_name, timestamp, timestamp),
            )
            connection.execute(
                """
                INSERT INTO sheets (
                    id,
                    video_id,
                    device_id,
                    products,
                    hashtag_inline,
                    hashtag_common,
                    created_by_duplicate,
                    status,
                    meta,
                    version,
                    started_at,
                    finished_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, '', '', NULL, ?, ?, 'idle', ?, 0, NULL, NULL, ?, ?)
                """,
                (
                    job_id,
                    video_id,
                    hashtag_common,
                    1 if created_by_duplicate else 0,
                    json.dumps({"jobId": job_id}, ensure_ascii=True),
                    timestamp,
                    timestamp,
                ),
            )
            connection.commit()

        row = self._get_row_by_video_id_sync(video_id)
        if row is None:
            raise RuntimeError("failed to create row")
        return row

    def _rename_video_sync(self, old_name: str, new_name: str) -> SheetRow | None:
        timestamp = int(time.time())
        with self._connect() as connection:
            row = connection.execute(
                "SELECT id FROM videos WHERE video_name = ?",
                (old_name,),
            ).fetchone()
            if row is None:
                return None
            video_id = str(row["id"])
            connection.execute(
                "UPDATE videos SET video_name = ?, updated_at = ? WHERE id = ?",
                (new_name, timestamp, video_id),
            )
            connection.execute(
                "UPDATE sheets SET updated_at = ?, version = version + 1 WHERE video_id = ?",
                (timestamp, video_id),
            )
            connection.commit()
        return self._get_row_by_video_id_sync(video_id)

    def _update_row_sync(self, video_id: str, payload: UpdateSheetRowRequest) -> SheetRow:
        row = self._get_row_by_video_id_sync(video_id)
        if row is None:
            raise ValueError("row not found")
        if row.status == "running":
            raise ValueError("cannot edit row while running")
        if payload.version is not None and payload.version != row.version:
            raise ValueError("row version conflict")

        meta_value = row.meta
        if payload.meta is not None:
            if isinstance(payload.meta, dict):
                meta_value = json.dumps(payload.meta, ensure_ascii=True)
            else:
                meta_value = payload.meta

        updates = {
            "device_id": row.deviceId if payload.device_id is None else payload.device_id,
            "products": row.products if payload.products is None else payload.products,
            "hashtag_inline": row.hashtagInline if payload.hashtag_inline is None else payload.hashtag_inline,
            "hashtag_common": row.hashtagCommon,
            "status": row.status if payload.status is None else payload.status,
            "meta": meta_value,
            "started_at": row.startedAt if payload.started_at is None else payload.started_at,
            "finished_at": row.finishedAt if payload.finished_at is None else payload.finished_at,
        }

        timestamp = int(time.time())
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sheets
                SET
                    device_id = ?,
                    products = ?,
                    hashtag_inline = ?,
                    hashtag_common = ?,
                    status = ?,
                    meta = ?,
                    started_at = ?,
                    finished_at = ?,
                    updated_at = ?,
                    version = version + 1
                WHERE video_id = ?
                """,
                (
                    updates["device_id"],
                    updates["products"],
                    updates["hashtag_inline"],
                    updates["hashtag_common"],
                    updates["status"],
                    updates["meta"],
                    updates["started_at"],
                    updates["finished_at"],
                    timestamp,
                    video_id,
                ),
            )
            connection.commit()

        updated = self._get_row_by_video_id_sync(video_id)
        if updated is None:
            raise RuntimeError("failed to reload row")
        return updated

    def _update_status_sync(self, video_id: str, status: str) -> SheetRow:
        timestamp = int(time.time())
        with self._connect() as connection:
            started_at = None
            finished_at = None
            if status == "running":
                started_at = timestamp
            elif status in {"done", "error", "stopped", "idle"}:
                finished_at = timestamp

            connection.execute(
                """
                UPDATE sheets
                SET
                    status = ?,
                    started_at = COALESCE(?, started_at),
                    finished_at = COALESCE(?, finished_at),
                    updated_at = ?,
                    version = version + 1
                WHERE video_id = ?
                """,
                (status, started_at, finished_at, timestamp, video_id),
            )
            connection.commit()

        updated = self._get_row_by_video_id_sync(video_id)
        if updated is None:
            raise RuntimeError("failed to reload status")
        return updated

    def _set_meta_job_id_sync(self, video_id: str, job_id: str) -> None:
        row = self._get_row_by_video_id_sync(video_id)
        if row is None:
            return

        payload: dict[str, str] = {"jobId": job_id}
        if row.meta:
            try:
                decoded = json.loads(row.meta)
                if isinstance(decoded, dict):
                    payload = {**decoded, "jobId": job_id}
            except json.JSONDecodeError:
                payload = {"jobId": job_id, "raw": row.meta}

        timestamp = int(time.time())
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sheets
                SET meta = ?, updated_at = ?, version = version + 1
                WHERE video_id = ?
                """,
                (json.dumps(payload, ensure_ascii=True), timestamp, video_id),
            )
            connection.commit()

    def _set_all_rows_hashtag_common_sync(self, hashtag_common: str | None) -> None:
        timestamp = int(time.time())
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sheets
                SET
                    hashtag_common = ?,
                    updated_at = ?,
                    version = version + 1
                """,
                (hashtag_common, timestamp),
            )
            connection.commit()

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped if stripped else None

    def _reset_ready_queued_sync(self) -> None:
        timestamp = int(time.time())
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE sheets
                SET
                    status = 'idle',
                    updated_at = ?,
                    version = version + 1
                WHERE status IN ('ready', 'queued')
                """,
                (timestamp,),
            )
            connection.commit()

    def _row_from_db(self, row: sqlite3.Row) -> SheetRow:
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
