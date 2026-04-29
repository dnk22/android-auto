from __future__ import annotations

import asyncio

from ..actions.device_file import delete_device_file
from ..actions.wait import wait_seconds
from ..constants import STEP_CLEANUP_DEVICE, TIMEOUT
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if auto_log_context is not None:
        await auto_log_context.info(
            event="cleanup_device_mock",
            message="Dọn dẹp thiết bị",
            step_key=STEP_CLEANUP_DEVICE,
        )

    device_video_path = payload.device_video_path or payload.extra.get("deviceVideoPath")
    if device_video_path:
        try:
            await delete_device_file(
                device_id=payload.device_id,
                device_video_path=device_video_path,
                auto_log_context=auto_log_context,
            )
            if auto_log_context is not None:
                await auto_log_context.info(
                    event="cleanup_device_deleted",
                    message="Đã xóa video khỏi thiết bị",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path},
                )
        except Exception as exc:
            if auto_log_context is not None:
                await auto_log_context.warning(
                    event="cleanup_device_delete_failed",
                    message=f"Xóa video khỏi thiết bị thất bại: {exc}",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path},
                )
