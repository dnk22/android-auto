from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Protocol
from uuid import uuid4

from app.automation.models.job_model import AutomationJob
from app.automation.models.sheet_model import SheetConfig, SheetRow, SheetState
from app.automation.schemas.automation_schema import UpdateSheetRowRequest
from app.automation.utils.validator import validate_row


class StorageServiceProtocol(Protocol):
    async def has_file(self, video_name: str) -> bool: ...


class JobQueueServiceProtocol(Protocol):
    async def enqueue(self, video_id: str, device_id: str) -> AutomationJob: ...

    async def stop_job_by_video_id(self, video_id: str) -> AutomationJob | None: ...


class SheetService:
    def __init__(self, *, logger: logging.Logger, ready_debounce_sec: float) -> None:
        self._logger = logger
        self._ready_debounce_sec = ready_debounce_sec
        self._rows_by_id: dict[str, SheetRow] = {}
        self._video_to_id: dict[str, str] = {}
        self._config = SheetConfig()
        self._debounce_nonce: dict[str, int] = {}
        self._debounce_tasks: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

        self._storage_service: StorageServiceProtocol | None = None
        self._queue_service: JobQueueServiceProtocol | None = None

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
        async with self._lock:
            rows = list(self._rows_by_id.values())
            return SheetState(rows=rows, config=self._config)

    async def get_row(self, video_id: str) -> SheetRow | None:
        async with self._lock:
            row = self._rows_by_id.get(video_id)
            return row.model_copy(deep=True) if row else None

    async def get_config(self) -> SheetConfig:
        async with self._lock:
            return self._config.model_copy(deep=True)

    async def get_video_name(self, video_id: str) -> str | None:
        async with self._lock:
            row = self._rows_by_id.get(video_id)
            return row.videoName if row else None

    async def has_video_name(self, video_name: str) -> bool:
        async with self._lock:
            return video_name in self._video_to_id

    async def upsert_from_storage(self, video_name: str, *, created_by_duplicate: bool) -> SheetRow:
        video_id_base = Path(video_name).stem
        async with self._lock:
            existing_video_id = self._video_to_id.get(video_name)
            if existing_video_id and existing_video_id in self._rows_by_id:
                row = self._rows_by_id[existing_video_id]
                row.status = "idle"
                row.createdByDuplicate = created_by_duplicate
                return row.model_copy(deep=True)

            video_id = video_id_base
            while video_id in self._rows_by_id:
                video_id = f"{video_id_base}_{uuid4().hex[:6]}"

            row = SheetRow(
                videoId=video_id,
                videoName=video_name,
                products="",
                status="idle",
                createdByDuplicate=created_by_duplicate,
                deviceId="",
                hashtagInline=None,
                meta={},
            )
            self._rows_by_id[video_id] = row
            self._video_to_id[video_name] = video_id

        self._log("info", "sheet_row_created", videoId=row.videoId, videoName=row.videoName)
        await self._auto_ready_if_needed(row.videoId)
        return row.model_copy(deep=True)

    async def mark_file_removed(self, video_name: str) -> SheetRow | None:
        row = await self._get_row_by_video_name(video_name)
        if row is None:
            return None

        if row.status == "running" and self._queue_service is not None:
            await self._queue_service.stop_job_by_video_id(row.videoId)

        async with self._lock:
            mutable = self._rows_by_id[row.videoId]
            mutable.status = "missing_file"
            return mutable.model_copy(deep=True)

    async def rename_video(self, old_name: str, new_name: str) -> SheetRow | None:
        async with self._lock:
            video_id = self._video_to_id.pop(old_name, None)
            if video_id is None or video_id not in self._rows_by_id:
                return None
            self._video_to_id[new_name] = video_id
            row = self._rows_by_id[video_id]
            row.videoName = new_name
            return row.model_copy(deep=True)

    async def assert_can_delete(self, video_name: str) -> None:
        row = await self._get_row_by_video_name(video_name)
        if row is None:
            return
        if row.status == "ready":
            raise ValueError("cannot delete file when row status is ready")

    async def update_row(self, video_id: str, payload: UpdateSheetRowRequest) -> SheetRow:
        async with self._lock:
            if video_id not in self._rows_by_id:
                raise ValueError("row not found")

            row = self._rows_by_id[video_id]
            if row.status == "running":
                raise ValueError("cannot edit row while running")

            if payload.products is not None:
                row.products = payload.products
            if payload.device_id is not None:
                row.deviceId = payload.device_id
            if payload.hashtag_inline is not None:
                row.hashtagInline = payload.hashtag_inline
            if payload.meta is not None:
                row.meta = payload.meta

            updated = row.model_copy(deep=True)

        await self._auto_ready_if_needed(video_id)
        return updated

    async def set_ready(self, video_id: str) -> SheetRow:
        if self._storage_service is None:
            raise RuntimeError("storage service is not bound")

        async with self._lock:
            row = self._rows_by_id.get(video_id)
            if row is None:
                raise ValueError("row not found")
            if row.status == "running":
                raise ValueError("row is running")

            exists = await self._storage_service.has_file(row.videoName)
            ok, reason = validate_row(row, self._config, exists)
            if not ok:
                raise ValueError(reason or "row is invalid")

            row.status = "ready"
            updated = row.model_copy(deep=True)

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
        async with self._lock:
            row = self._rows_by_id.get(video_id)
            if row is None:
                return

            if status == "running":
                row.status = "running"
            elif status == "done":
                row.status = "done"
            elif status == "error":
                row.status = "error"
            elif status == "stopped":
                row.status = "idle"

    async def cancel(self) -> None:
        async with self._lock:
            tasks = list(self._debounce_tasks.values())
            self._debounce_tasks.clear()

        for task in tasks:
            task.cancel()

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _get_row_by_video_name(self, video_name: str) -> SheetRow | None:
        async with self._lock:
            video_id = self._video_to_id.get(video_name)
            if video_id is None:
                return None
            row = self._rows_by_id.get(video_id)
            return row.model_copy(deep=True) if row else None

    async def _auto_ready_if_needed(self, video_id: str) -> None:
        async with self._lock:
            auto_ready = self._config.autoReady
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

                row = self._rows_by_id.get(video_id)
                if row is None or row.status != "ready":
                    return
                device_id = row.deviceId

            job = await self._queue_service.enqueue(video_id, device_id)

            async with self._lock:
                row = self._rows_by_id.get(video_id)
                if row is not None:
                    row.meta = {**(row.meta or {}), "jobId": job.jobId}

            self._log("info", "job_enqueued", videoId=video_id, deviceId=device_id)
        except asyncio.CancelledError:
            return
