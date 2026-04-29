from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import uiautomator2 as u2

from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger

from .constants import (
    STEP_ATTACH_PRODUCTS,
    STEP_CLEANUP_DEVICE,
    STEP_EDIT_VIDEO_SETTINGS,
    STEP_INPUT_HASHTAG,
    STEP_OPEN_UPLOAD_FLOW,
    STEP_PREPARE_VIDEO,
    STEP_SELECT_VIDEO,
    STEP_SUBMIT_VIDEO,
    STEP_WAIT_PUBLISH_RESULT,
    get_cleanup_step,
    get_main_steps,
)
from .exceptions import PauseRequiredException, StepFailedException
from .payload import ShopeeUploadPayload
from .steps import (
    attach_products,
    cleanup_device,
    edit_video_settings,
    input_hashtag,
    open_upload_flow,
    prepare_video,
    select_video,
    submit_video,
    wait_publish_result,
)

StepHandler = Callable[[ShopeeUploadPayload, Any], Awaitable[None]]


class ShopeeUploadRunner:
    def __init__(
        self,
        *,
        logger: AutomationSystemLogger,
        timeout_sec: float,
    ) -> None:
        self._logger = logger
        self._timeout_sec = timeout_sec
        self._connections: dict[str, Any] = {}

    async def connect(self, device_id: str) -> Any:
        connection = await asyncio.wait_for(
            asyncio.to_thread(u2.connect, device_id),
            timeout=self._timeout_sec,
        )
        self._connections[device_id] = connection
        return connection

    async def run(
        self,
        payload: ShopeeUploadPayload,
        auto_log_context=None,
    ) -> None:
        try:
            if payload.connection is None:
                payload.connection = await self.connect(payload.device_id)
        except Exception as exc:
            self._logger.error(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_failed",
                message=f"Shopee bot failed to connect to device {payload.device_id}: {exc}",
                deviceId=payload.device_id,
                meta={
                    "executionId": payload.execution_id,
                    "videoId": payload.video_id,
                    "error": str(exc),
                },
            )
            raise RuntimeError("device disconnected") from exc

        self._logger.info(
            component=AutomationLogComponent.SHOPEE_BOT,
            event="bot_started",
            message="Shopee upload runner started",
            deviceId=payload.device_id,
            meta={
                "executionId": payload.execution_id,
                "videoId": payload.video_id,
                "videoPath": payload.local_video_path,
                "products": payload.products,
                "hashtag": payload.hashtag,
            },
        )

        main_error: Exception | None = None

        try:
            for step in get_main_steps():
                await self._run_step(
                    step=step,
                    handler=self._get_step_handler(str(step["key"])),
                    payload=payload,
                    auto_log_context=auto_log_context,
                )
        except Exception as exc:
            main_error = exc
            raise
        finally:
            await self._run_cleanup(payload, auto_log_context, main_error)

        self._logger.success(
            component=AutomationLogComponent.SHOPEE_BOT,
            event="bot_finished",
            message="Shopee upload runner finished",
            deviceId=payload.device_id,
            meta={
                "executionId": payload.execution_id,
                "videoId": payload.video_id,
            },
        )

    async def _run_step(
        self,
        *,
        step: dict[str, Any],
        handler: StepHandler,
        payload: ShopeeUploadPayload,
        auto_log_context=None,
    ) -> None:
        step_key = str(step["key"])
        step_name = str(step.get("name") or step_key)

        if auto_log_context is not None:
            await auto_log_context.start_step(step_key, f"Dang {step_name.lower()}")

        try:
            await handler(payload, auto_log_context)
        except PauseRequiredException as exc:
            if auto_log_context is not None:
                await auto_log_context.fail_step(
                    step_key=exc.step_key or step_key,
                    error=exc,
                    reason=exc.reason,
                    meta=exc.meta,
                )
            raise
        except Exception as exc:
            if auto_log_context is not None:
                await auto_log_context.fail_step(
                    step_key=step_key,
                    error=exc,
                    reason="step_failed",
                    meta={"exceptionType": type(exc).__name__},
                )
            raise

        if auto_log_context is not None:
            await auto_log_context.finish_step(step_key, f"{step_name} thanh cong")

    async def _run_cleanup(
        self,
        payload: ShopeeUploadPayload,
        auto_log_context=None,
        main_error: Exception | None = None,
    ) -> None:
        cleanup_step = get_cleanup_step()

        try:
            await self._run_step(
                step=cleanup_step,
                handler=self._get_step_handler(str(cleanup_step["key"])),
                payload=payload,
                auto_log_context=auto_log_context,
            )
        except Exception as exc:
            self._logger.warning(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="cleanup_failed",
                message=f"Cleanup device failed: {exc}",
                deviceId=payload.device_id,
                meta={
                    "executionId": payload.execution_id,
                    "videoId": payload.video_id,
                    "error": str(exc),
                    "mainError": str(main_error) if main_error else None,
                },
            )

            if auto_log_context is not None:
                await auto_log_context.warning(
                    event="cleanup_failed",
                    message=f"Don dep thiet bi that bai: {exc}",
                    step_key=str(cleanup_step["key"]),
                    reason="cleanup_failed",
                    meta={"exceptionType": type(exc).__name__},
                )

    def _get_step_handler(self, step_key: str) -> StepHandler:
        mapping: dict[str, StepHandler] = {
            STEP_PREPARE_VIDEO: prepare_video.run,
            STEP_OPEN_UPLOAD_FLOW: open_upload_flow.run,
            STEP_SELECT_VIDEO: select_video.run,
            STEP_INPUT_HASHTAG: input_hashtag.run,
            STEP_EDIT_VIDEO_SETTINGS: edit_video_settings.run,
            STEP_ATTACH_PRODUCTS: attach_products.run,
            STEP_SUBMIT_VIDEO: submit_video.run,
            STEP_WAIT_PUBLISH_RESULT: wait_publish_result.run,
            STEP_CLEANUP_DEVICE: cleanup_device.run,
        }

        if step_key not in mapping:
            raise StepFailedException(
                f"No handler found for step: {step_key}",
                step_key=step_key,
                reason="missing_step_handler",
            )

        return mapping[step_key]

    async def stop_device(self, device_id: str) -> None:
        connection = self._connections.get(device_id)
        if connection is None:
            return

        try:
            await asyncio.to_thread(connection.reset_uiautomator)
        except Exception as exc:
            self._logger.warning(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_stopped",
                message=f"Shopee bot stop failed: {exc}",
                deviceId=device_id,
                meta={"error": str(exc)},
            )
        finally:
            self._connections.pop(device_id, None)
