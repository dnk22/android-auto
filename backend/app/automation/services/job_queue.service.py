from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Protocol

from app.automation.constants.automation_constants import ExecutionStatus, SheetStatus
from app.automation.models.job_model import AutomationJob
from app.automation.models.runtime_job_model import RuntimeJob
from app.automation.utils.validator import build_hashtag, parse_products


class SheetServiceProtocol(Protocol):
    async def get_row(self, video_id: str): ...

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


class ExecutionServiceProtocol(Protocol):
    def get_by_id(self, execution_id: str): ...

    def mark_running(self, execution_id: str): ...

    def mark_done(self, execution_id: str, *, result_meta: str | None = None): ...

    def mark_error(self, execution_id: str, error_message: str): ...

    def mark_stopped(self, execution_id: str): ...

    def get_active_by_video_id(self, video_id: str): ...


class DeviceLockServiceProtocol(Protocol):
    def release_by_execution(self, execution_id: str) -> None: ...


class JobQueueService:
    def __init__(
        self,
        *,
        sheet_service: SheetServiceProtocol,
        storage_service: StorageServiceProtocol,
        shopee_bot: ShopeeBotProtocol,
        execution_service: ExecutionServiceProtocol,
        device_lock_service: DeviceLockServiceProtocol,
        logger: logging.Logger,
    ) -> None:
        self._sheet_service = sheet_service
        self._storage_service = storage_service
        self._shopee_bot = shopee_bot
        self._execution_service = execution_service
        self._device_lock_service = device_lock_service
        self._logger = logger

        self._queue: asyncio.Queue[RuntimeJob] = asyncio.Queue()
        self._jobs: dict[str, AutomationJob] = {}
        self._running_tasks: dict[str, asyncio.Task[None]] = {}
        self._stopped_execution_ids: set[str] = set()
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

    async def enqueue_runtime_job(self, runtime_job: RuntimeJob) -> None:
        now = time.time()
        async with self._lock:
            current = self._jobs.get(runtime_job.execution_id)
            if current is None:
                self._jobs[runtime_job.execution_id] = AutomationJob(
                    jobId=runtime_job.execution_id,
                    videoId=runtime_job.video_id,
                    deviceId=runtime_job.assigned_device,
                    status="queued",
                    createdAt=now,
                )
            else:
                current.status = "queued"
        await self._queue.put(runtime_job)
        self._log(
            "info",
            "runtime_job_queued",
            executionId=runtime_job.execution_id,
            videoId=runtime_job.video_id,
            deviceId=runtime_job.assigned_device,
        )

    async def stop_job(self, job_id: str) -> AutomationJob:
        execution = await asyncio.to_thread(self._execution_service.get_by_id, job_id)
        if execution is None:
            raise ValueError("job not found")

        async with self._lock:
            self._stopped_execution_ids.add(job_id)
            running = self._running_tasks.get(job_id)
            cached = self._jobs.get(job_id)
            if cached is None:
                cached = AutomationJob(
                    jobId=job_id,
                    videoId=execution.videoId,
                    deviceId=execution.assignedDevice or "",
                    status="stopped",
                    createdAt=time.time(),
                )
                self._jobs[job_id] = cached
            else:
                cached.status = "stopped"

        if running and not running.done():
            running.cancel()

        if execution.assignedDevice:
            await self._shopee_bot.stop_device(execution.assignedDevice)

        await asyncio.to_thread(self._execution_service.mark_stopped, job_id)
        await self._sheet_service.on_job_status(execution.videoId, SheetStatus.STOPPED)
        await asyncio.to_thread(self._device_lock_service.release_by_execution, job_id)
        self._log("info", "execution_stopped", executionId=job_id, videoId=execution.videoId)
        return cached.model_copy(deep=True)

    async def stop_job_by_video_id(self, video_id: str) -> AutomationJob | None:
        execution = await asyncio.to_thread(self._execution_service.get_active_by_video_id, video_id)
        if execution is None:
            return None
        return await self.stop_job(execution.id)

    async def _worker_loop(self) -> None:
        try:
            while True:
                runtime_job = await self._queue.get()
                try:
                    if runtime_job.execution_id in self._stopped_execution_ids:
                        continue

                    task = asyncio.create_task(self._run_execution(runtime_job))
                    async with self._lock:
                        self._running_tasks[runtime_job.execution_id] = task

                    try:
                        await task
                    finally:
                        async with self._lock:
                            self._running_tasks.pop(runtime_job.execution_id, None)
                finally:
                    self._queue.task_done()
        except asyncio.CancelledError:
            return

    async def _run_execution(self, runtime_job: RuntimeJob) -> None:
        execution = await asyncio.to_thread(self._execution_service.get_by_id, runtime_job.execution_id)
        if execution is None:
            await asyncio.to_thread(
                self._device_lock_service.release_by_execution,
                runtime_job.execution_id,
            )
            return

        if execution.status != ExecutionStatus.ASSIGNED:
            await asyncio.to_thread(
                self._device_lock_service.release_by_execution,
                runtime_job.execution_id,
            )
            return

        row = await self._sheet_service.get_row(execution.videoId)
        if row is None:
            await asyncio.to_thread(
                self._execution_service.mark_error,
                execution.id,
                "Sheet item not found",
            )
            await asyncio.to_thread(
                self._device_lock_service.release_by_execution,
                runtime_job.execution_id,
            )
            return

        if row.status != SheetStatus.QUEUED:
            await asyncio.to_thread(self._execution_service.mark_stopped, execution.id)
            await asyncio.to_thread(
                self._device_lock_service.release_by_execution,
                runtime_job.execution_id,
            )
            return

        marked_running = await asyncio.to_thread(self._execution_service.mark_running, execution.id)
        if marked_running is None:
            await asyncio.to_thread(
                self._device_lock_service.release_by_execution,
                runtime_job.execution_id,
            )
            return
        await self._sheet_service.on_job_status(execution.videoId, SheetStatus.RUNNING)
        async with self._lock:
            cached = self._jobs.get(execution.id)
            if cached is None:
                cached = AutomationJob(
                    jobId=execution.id,
                    videoId=execution.videoId,
                    deviceId=execution.assignedDevice or runtime_job.assigned_device,
                    status="running",
                    createdAt=time.time(),
                )
                self._jobs[execution.id] = cached
            else:
                cached.status = "running"

        video_path = await self._storage_service.resolve_video_path(row.videoName)
        if video_path is None:
            await asyncio.to_thread(
                self._execution_service.mark_error,
                execution.id,
                "video file missing",
            )
            await self._sheet_service.on_job_status(execution.videoId, SheetStatus.ERROR)
            await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
            async with self._lock:
                if execution.id in self._jobs:
                    self._jobs[execution.id].status = "error"
            return

        products = parse_products(row.products)
        hashtag = build_hashtag(row)

        if not products:
            await asyncio.to_thread(self._execution_service.mark_error, execution.id, "products is empty")
            await self._sheet_service.on_job_status(execution.videoId, SheetStatus.ERROR)
            await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
            async with self._lock:
                if execution.id in self._jobs:
                    self._jobs[execution.id].status = "error"
            return
        if not hashtag:
            await asyncio.to_thread(self._execution_service.mark_error, execution.id, "hashtag is empty")
            await self._sheet_service.on_job_status(execution.videoId, SheetStatus.ERROR)
            await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
            async with self._lock:
                if execution.id in self._jobs:
                    self._jobs[execution.id].status = "error"
            return

        try:
            await self._shopee_bot.run(
                device_id=execution.assignedDevice or runtime_job.assigned_device,
                video_path=str(video_path),
                products=products,
                hashtag=hashtag,
            )
        except asyncio.CancelledError:
            if runtime_job.execution_id not in self._stopped_execution_ids:
                await asyncio.to_thread(self._execution_service.mark_stopped, execution.id)
                await self._sheet_service.on_job_status(execution.videoId, SheetStatus.STOPPED)
            await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
            async with self._lock:
                if execution.id in self._jobs:
                    self._jobs[execution.id].status = "stopped"
            raise
        except Exception as exc:  # noqa: BLE001
            await asyncio.to_thread(self._execution_service.mark_error, execution.id, str(exc))
            await self._sheet_service.on_job_status(execution.videoId, SheetStatus.ERROR)
            await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
            async with self._lock:
                if execution.id in self._jobs:
                    self._jobs[execution.id].status = "error"
            self._log(
                "error",
                "execution_runtime_error",
                executionId=execution.id,
                videoId=execution.videoId,
                reason=str(exc),
            )
            return

        await asyncio.to_thread(self._execution_service.mark_done, execution.id)
        await self._sheet_service.on_job_status(execution.videoId, SheetStatus.DONE)
        await asyncio.to_thread(self._device_lock_service.release_by_execution, execution.id)
        async with self._lock:
            if execution.id in self._jobs:
                self._jobs[execution.id].status = "done"
        self._log("info", "execution_done", executionId=execution.id, videoId=execution.videoId)
