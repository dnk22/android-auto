from __future__ import annotations

from typing import Any

from app.automation.constants.automation_constants import StopReason


class AutoLogContext:
    def __init__(
        self,
        *,
        execution: Any,
        row: Any,
        step_service,
        log_service,
        source: str = "shopee_bot",
        component: str = "shopee_bot",
    ) -> None:
        self.execution = execution
        self.row = row
        self.step_service = step_service
        self.log_service = log_service
        self.source = source
        self.component = component

    async def start_step(self, step_key: str, message: str, *, step_index: int | None = None, step_name: str | None = None) -> None:
        step = await self.step_service.mark_step_running(
            self.execution.id,
            step_key,
            self.execution.assignedDevice,
        )
        await self.log_service.info(
            execution_id=self.execution.id,
            event="step_started",
            message=message,
            job_id=self.execution.jobId,
            video_id=self.execution.videoId,
            device_id=self.execution.assignedDevice,
            step_id=step["id"] if step else None,
            step_index=step["stepIndex"] if step else step_index,
            step_key=step_key,
            step_name=step["stepName"] if step else step_name,
            source=self.source,
            component=self.component,
        )

    async def info(
        self,
        *,
        event: str,
        message: str,
        step_key: str | None = None,
        step_name: str | None = None,
        meta: dict[str, Any] | None = None,
        reason: str | None = None,
    ) -> None:
        await self._log(
            level="info",
            event=event,
            message=message,
            step_key=step_key,
            step_name=step_name,
            meta=meta,
            reason=reason,
        )

    async def success(
        self,
        *,
        event: str,
        message: str,
        step_key: str | None = None,
        step_name: str | None = None,
        meta: dict[str, Any] | None = None,
        reason: str | None = None,
    ) -> None:
        await self._log(
            level="success",
            event=event,
            message=message,
            step_key=step_key,
            step_name=step_name,
            meta=meta,
            reason=reason,
        )

    async def warning(
        self,
        *,
        event: str,
        message: str,
        step_key: str | None = None,
        step_name: str | None = None,
        meta: dict[str, Any] | None = None,
        reason: str | None = None,
    ) -> None:
        await self._log(
            level="warning",
            event=event,
            message=message,
            step_key=step_key,
            step_name=step_name,
            meta=meta,
            reason=reason,
        )

    async def finish_step(self, step_key: str, message: str, *, meta: dict[str, Any] | None = None) -> None:
        step = await self.step_service.mark_step_done(
            self.execution.id,
            step_key,
            meta=meta,
        )
        await self.log_service.success(
            execution_id=self.execution.id,
            event="step_succeeded",
            message=message,
            job_id=self.execution.jobId,
            video_id=self.execution.videoId,
            device_id=self.execution.assignedDevice,
            step_id=step["id"] if step else None,
            step_index=step["stepIndex"] if step else None,
            step_key=step_key,
            step_name=step["stepName"] if step else None,
            source=self.source,
            component=self.component,
            meta=meta,
        )

    async def fail_step(
        self,
        step_key: str,
        error: Exception | str,
        *,
        step_name: str | None = None,
        reason: str = StopReason.STEP_FAILED,
        meta: dict[str, Any] | None = None,
    ) -> None:
        error_message = str(error)
        step = await self.step_service.mark_step_error(
            self.execution.id,
            step_key,
            error_message=error_message,
            meta=meta,
        )
        await self.log_service.error(
            execution_id=self.execution.id,
            event="step_failed",
            message=f"{step_name or step_key} that bai: {error_message}",
            job_id=self.execution.jobId,
            video_id=self.execution.videoId,
            device_id=self.execution.assignedDevice,
            step_id=step["id"] if step else None,
            step_index=step["stepIndex"] if step else None,
            step_key=step_key,
            step_name=step["stepName"] if step else step_name,
            source=self.source,
            component=self.component,
            reason=reason,
            meta=meta,
        )

    async def _log(
        self,
        *,
        level: str,
        event: str,
        message: str,
        step_key: str | None,
        step_name: str | None,
        meta: dict[str, Any] | None,
        reason: str | None,
    ) -> None:
        step = None
        if step_key:
            step = await self.step_service.get_current_running_step(self.execution.id)
            if step is not None and step.get("stepKey") != step_key:
                step = None

        log_method = getattr(self.log_service, level)
        await log_method(
            execution_id=self.execution.id,
            event=event,
            message=message,
            job_id=self.execution.jobId,
            video_id=self.execution.videoId,
            device_id=self.execution.assignedDevice,
            step_id=step["id"] if step else None,
            step_index=step["stepIndex"] if step else None,
            step_key=step_key,
            step_name=(step["stepName"] if step else step_name),
            source=self.source,
            component=self.component,
            reason=reason,
            meta=meta,
        )
