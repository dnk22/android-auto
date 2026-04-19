from __future__ import annotations

import asyncio
import json
import logging
import time
from collections import defaultdict
from typing import Protocol
from uuid import uuid4

from app.automation.models.job_model import AutomationJob
from app.automation.utils.validator import build_hashtag, parse_products


class SheetServiceProtocol(Protocol):
    async def get_row(self, video_id: str): ...

    async def get_config(self): ...

    async def on_job_status(self, video_id: str, status: str) -> None: ...


class StorageServiceProtocol(Protocol):
    async def resolve_video_path(self, video_name: str): ...


class ShopeeBotProtocol(Protocol):
    async def run(
        self,
        device_id: str,
        video_path: str,
        products: list[str],
        hashtag: str,
    ) -> None: ...

    async def stop_device(self, device_id: str) -> None: ...


class JobQueueService:
    def __init__(
        self,
        *,
        sheet_service: SheetServiceProtocol,
        storage_service: StorageServiceProtocol,
        shopee_bot: ShopeeBotProtocol,
        logger: logging.Logger,
    ) -> None:
        self._sheet_service = sheet_service
        self._storage_service = storage_service
        self._shopee_bot = shopee_bot
        self._logger = logger

        self._queue: asyncio.Queue[AutomationJob] = asyncio.Queue()
        self._jobs: dict[str, AutomationJob] = {}
        self._device_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._running_tasks: dict[str, asyncio.Task[None]] = {}
        self._stopped_job_ids: set[str] = set()
        self._worker_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    def _log(self, level: str, event: str, **meta: object) -> None:
        payload = {
            "ts": int(time.time()),
            "service": "automation",
            "component": "job_queue",
            "event": event,
            "meta": meta,
        }
        getattr(self._logger, level)(json.dumps(payload, ensure_ascii=True))

    async def start(self) -> None:
        async with self._lock:
            if self._worker_task and not self._worker_task.done():
                return
            self._worker_task = asyncio.create_task(self._worker_loop())
            self._log("info", "worker_started")

    async def stop(self) -> None:
        async with self._lock:
            worker = self._worker_task
            self._worker_task = None

        running = list(self._running_tasks.values())
        for task in running:
            task.cancel()
        if running:
            await asyncio.gather(*running, return_exceptions=True)

        if worker:
            worker.cancel()
            await asyncio.gather(worker, return_exceptions=True)
            self._log("info", "worker_stopped")

    async def enqueue(self, video_id: str, device_id: str) -> AutomationJob:
        job = AutomationJob(
            jobId=uuid4().hex,
            videoId=video_id,
            deviceId=device_id,
            status="queued",
            createdAt=time.time(),
        )
        async with self._lock:
            self._jobs[job.jobId] = job
        await self._queue.put(job)
        self._log("info", "job_queued", jobId=job.jobId, videoId=video_id, deviceId=device_id)
        return job

    async def stop_job(self, job_id: str) -> AutomationJob:
        async with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                raise ValueError("job not found")
            job.status = "stopped"
            self._stopped_job_ids.add(job_id)
            running = self._running_tasks.get(job_id)

        if running and not running.done():
            running.cancel()

        await self._shopee_bot.stop_device(job.deviceId)
        await self._sheet_service.on_job_status(job.videoId, "stopped")
        self._log("info", "job_stopped", jobId=job_id)
        return job.model_copy(deep=True)

    async def stop_job_by_video_id(self, video_id: str) -> AutomationJob | None:
        async with self._lock:
            candidates = [
                job
                for job in self._jobs.values()
                if job.videoId == video_id and job.status in {"queued", "running"}
            ]
        if not candidates:
            return None

        target = sorted(candidates, key=lambda item: item.createdAt)[-1]
        return await self.stop_job(target.jobId)

    async def _worker_loop(self) -> None:
        try:
            while True:
                job = await self._queue.get()
                try:
                    if job.jobId in self._stopped_job_ids or job.status == "stopped":
                        continue

                    device_lock = self._device_locks[job.deviceId]
                    async with device_lock:
                        if job.jobId in self._stopped_job_ids:
                            continue

                        async with self._lock:
                            current = self._jobs.get(job.jobId)
                            if current is None:
                                continue
                            current.status = "running"

                        await self._sheet_service.on_job_status(job.videoId, "running")
                        task = asyncio.create_task(self._execute_job(job))
                        async with self._lock:
                            self._running_tasks[job.jobId] = task

                        try:
                            await task
                        finally:
                            async with self._lock:
                                self._running_tasks.pop(job.jobId, None)
                finally:
                    self._queue.task_done()
        except asyncio.CancelledError:
            return

    async def _execute_job(self, job: AutomationJob) -> None:
        row = await self._sheet_service.get_row(job.videoId)
        if row is None:
            await self._set_error(job, "row not found")
            return

        video_path = await self._storage_service.resolve_video_path(row.videoName)
        if video_path is None:
            await self._set_error(job, "video file missing")
            return

        config = await self._sheet_service.get_config()
        products = parse_products(row.products)
        hashtag = build_hashtag(row, config)

        if not products:
            await self._set_error(job, "products is empty")
            return
        if not hashtag:
            await self._set_error(job, "hashtag is empty")
            return

        try:
            await self._shopee_bot.run(
                device_id=job.deviceId,
                video_path=str(video_path),
                products=products,
                hashtag=hashtag,
            )
        except asyncio.CancelledError:
            await self._sheet_service.on_job_status(job.videoId, "stopped")
            async with self._lock:
                if job.jobId in self._jobs:
                    self._jobs[job.jobId].status = "stopped"
            raise
        except Exception as exc:  # noqa: BLE001
            await self._set_error(job, str(exc))
            return

        async with self._lock:
            if job.jobId in self._jobs:
                self._jobs[job.jobId].status = "done"
        await self._sheet_service.on_job_status(job.videoId, "done")
        self._log("info", "job_done", jobId=job.jobId, videoId=job.videoId)

    async def _set_error(self, job: AutomationJob, reason: str) -> None:
        async with self._lock:
            if job.jobId in self._jobs:
                self._jobs[job.jobId].status = "error"
        await self._sheet_service.on_job_status(job.videoId, "error")
        self._log("error", "job_error", jobId=job.jobId, videoId=job.videoId, reason=reason)
