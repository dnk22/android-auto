from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

import uiautomator2 as u2

from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger

from .constants import STEP_OPEN_UPLOAD_FLOW, STEP_PREPARE_VIDEO, STEP_SELECT_VIDEO
from .exceptions import PauseRequiredException, StepFailedException
from .payload import ShopeeUploadPayload
from .steps import open_upload_flow, prepare_video, select_video

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

        await self._run_step(
            step={"key": STEP_PREPARE_VIDEO, "name": "Đẩy video vào thiết bị"},
            handler=self._get_step_handler(STEP_PREPARE_VIDEO),
            payload=payload,
            auto_log_context=auto_log_context,
        )

        await self._run_step(
            step={"key": STEP_OPEN_UPLOAD_FLOW, "name": "Mở màn đăng video"},
            handler=self._get_step_handler(STEP_OPEN_UPLOAD_FLOW),
            payload=payload,
            auto_log_context=auto_log_context,
        )
        await self._run_step(
            step={"key": STEP_SELECT_VIDEO, "name": "Chọn video từ thư viện"},
            handler=self._get_step_handler(STEP_SELECT_VIDEO),
            payload=payload,
            auto_log_context=auto_log_context,
        )

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

    def _get_step_handler(self, step_key: str) -> StepHandler:
        mapping: dict[str, StepHandler] = {
            STEP_PREPARE_VIDEO: prepare_video.run,
            STEP_OPEN_UPLOAD_FLOW: open_upload_flow.run,
            STEP_SELECT_VIDEO: select_video.run,
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
