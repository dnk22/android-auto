from __future__ import annotations

import asyncio
import time
from typing import Protocol

from app.automation.constants.automation_constants import SheetStatus
from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger
from app.automation.models.job_execution_model import JobExecution
from app.automation.models.runtime_job_model import RuntimeJob


class ExecutionServiceProtocol(Protocol):
    def get_pending_executions(self, *, limit: int = 20) -> list[JobExecution]: ...

    def mark_assigned(self, execution_id: str, assigned_device: str) -> JobExecution | None: ...

    def mark_error(self, execution_id: str, error_message: str) -> JobExecution | None: ...


class SheetServiceProtocol(Protocol):
    async def get_row(self, video_id: str): ...

    async def on_job_status(self, video_id: str, status: str) -> None: ...


class DeviceLockServiceProtocol(Protocol):
    def acquire_lock(self, device_id: str, execution_id: str, *, locked_by: str | None = None) -> bool: ...

    def get_locked_devices(self) -> list[str]: ...

    def release_lock(self, device_id: str) -> None: ...


class QueueServiceProtocol(Protocol):
    async def enqueue_runtime_job(self, runtime_job: RuntimeJob) -> None: ...


class ExecutionDispatcherService:
    def __init__(
        self,
        *,
        execution_service: ExecutionServiceProtocol,
        sheet_service: SheetServiceProtocol,
        device_lock_service: DeviceLockServiceProtocol,
        queue_service: QueueServiceProtocol,
        logger: AutomationSystemLogger,
        poll_interval_sec: float,
    ) -> None:
        self._execution_service = execution_service
        self._sheet_service = sheet_service
        self._device_lock_service = device_lock_service
        self._queue_service = queue_service
        self._logger = logger
        self._poll_interval_sec = poll_interval_sec
        self._task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._task and not self._task.done():
                return
            self._task = asyncio.create_task(self._loop())
            self._logger.info(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="dispatcher_started",
                message="Execution dispatcher started",
            )

    async def stop(self) -> None:
        async with self._lock:
            task = self._task
            self._task = None

        if task:
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
            self._logger.info(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="dispatcher_stopped",
                message="Execution dispatcher stopped",
            )

    async def _loop(self) -> None:
        try:
            while True:
                executions = await asyncio.to_thread(
                    self._execution_service.get_pending_executions,
                    limit=20,
                )
                for execution in executions:
                    try:
                        await self._try_dispatch(execution)
                    except Exception as exc:  # noqa: BLE001
                        self._logger.error(
                            component=AutomationLogComponent.EXECUTION_DISPATCHER,
                            event="dispatch_failed",
                            message=f"Dispatch failed: {exc}",
                            meta={"executionId": execution.id, "error": str(exc)},
                        )
                await asyncio.sleep(self._poll_interval_sec)
        except asyncio.CancelledError:
            return

    async def _try_dispatch(self, execution: JobExecution) -> None:
        row = await self._sheet_service.get_row(execution.videoId)
        if row is None:
            await asyncio.to_thread(
                self._execution_service.mark_error,
                execution.id,
                "Sheet item not found",
            )
            self._logger.warning(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="pending_execution_missing_sheet_row",
                message="Pending execution has no matching sheet row",
                meta={"executionId": execution.id, "videoId": execution.videoId},
            )
            return
        if row.status != SheetStatus.QUEUED:
            return

        self._logger.info(
            component=AutomationLogComponent.EXECUTION_DISPATCHER,
            event="pending_execution_found",
            message="Found pending execution",
            meta={
                "executionId": execution.id,
                "jobId": execution.jobId,
                "videoId": execution.videoId,
                "requestedDevice": execution.requestedDevice,
            },
        )

        device_id = await self._pick_available_device(execution.requestedDevice)
        if not device_id:
            self._logger.warning(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="device_not_available",
                message="No available device for pending execution",
                meta={"executionId": execution.id, "requestedDevice": execution.requestedDevice},
            )
            return

        self._logger.info(
            component=AutomationLogComponent.EXECUTION_DISPATCHER,
            event="device_selected",
            message=f"Selected device {device_id}",
            deviceId=device_id,
            meta={"executionId": execution.id, "videoId": execution.videoId},
        )

        locked = await asyncio.to_thread(
            self._device_lock_service.acquire_lock,
            device_id,
            execution.id,
            locked_by="execution_dispatcher",
        )
        if not locked:
            self._logger.warning(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="device_lock_failed",
                message=f"Failed to acquire device lock for {device_id}",
                deviceId=device_id,
                meta={"executionId": execution.id},
            )
            return

        self._logger.success(
            component=AutomationLogComponent.EXECUTION_DISPATCHER,
            event="device_lock_acquired",
            message=f"Acquired device lock for {device_id}",
            deviceId=device_id,
            meta={"executionId": execution.id},
        )

        try:
            assigned = await asyncio.to_thread(
                self._execution_service.mark_assigned,
                execution.id,
                device_id,
            )
            if assigned is None:
                await asyncio.to_thread(self._device_lock_service.release_lock, device_id)
                return

            self._logger.success(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="execution_assigned",
                message=f"Execution assigned to device {device_id}",
                deviceId=device_id,
                meta={"executionId": execution.id, "videoId": execution.videoId},
            )

            await self._queue_service.enqueue_runtime_job(
                RuntimeJob(
                    execution_id=execution.id,
                    job_id=execution.jobId,
                    video_id=execution.videoId,
                    assigned_device=device_id,
                ),
            )
            self._logger.info(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="runtime_job_enqueued",
                message="Runtime job enqueued",
                deviceId=device_id,
                meta={"executionId": execution.id, "videoId": execution.videoId},
            )
        except Exception:
            await asyncio.to_thread(self._device_lock_service.release_lock, device_id)
            raise

    async def _pick_available_device(self, requested_device: str | None) -> str | None:
        online_devices = await self._list_online_devices()
        if not online_devices:
            return None
        locked_devices = set(
            await asyncio.to_thread(self._device_lock_service.get_locked_devices),
        )
        requested = (requested_device or "").strip()
        if not requested or requested.lower() == "all":
            for device_id in online_devices:
                if device_id not in locked_devices:
                    return device_id
            return None

        requested_pool = [item.strip() for item in requested.split(",") if item.strip()]
        for device_id in requested_pool:
            if device_id in online_devices and device_id not in locked_devices:
                return device_id
        return None

    async def _list_online_devices(self) -> list[str]:
        try:
            process = await asyncio.create_subprocess_exec(
                "adb",
                "devices",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError:
            self._logger.warning(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="adb_not_found",
                message="ADB executable not found",
            )
            return []
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="ignore").strip()
            self._logger.warning(
                component=AutomationLogComponent.EXECUTION_DISPATCHER,
                event="adb_devices_failed",
                message=f"Failed to list adb devices: {message}",
                meta={"error": message},
            )
            return []
        lines = stdout.decode("utf-8", errors="ignore").splitlines()
        devices: list[str] = []
        for line in lines[1:]:
            stripped = line.strip()
            if not stripped:
                continue
            columns = stripped.split()
            if len(columns) >= 2 and columns[1] == "device":
                devices.append(columns[0])
        return devices
