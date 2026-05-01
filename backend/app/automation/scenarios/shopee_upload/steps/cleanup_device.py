from __future__ import annotations

import asyncio

from ..actions.device_file import (
    delete_device_file,
    refresh_media_store_after_delete,
    verify_device_file_deleted,
)
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
            if auto_log_context is not None:
                await auto_log_context.info(
                    event="cleanup_device_delete_started",
                    message="Bat dau xoa video khoi thiet bi",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                )
            await delete_device_file(
                device_id=payload.device_id,
                device_video_path=device_video_path,
                auto_log_context=auto_log_context,
            )
            if auto_log_context is not None:
                await auto_log_context.success(
                    event="cleanup_device_delete_succeeded",
                    message="Da xoa file vat ly tren thiet bi",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                )

            if auto_log_context is not None:
                await auto_log_context.info(
                    event="cleanup_device_media_store_refresh_started",
                    message="Bat dau refresh MediaStore sau khi xoa file",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                )
            try:
                await refresh_media_store_after_delete(
                    device_id=payload.device_id,
                    device_video_path=device_video_path,
                    auto_log_context=auto_log_context,
                )
                if auto_log_context is not None:
                    await auto_log_context.success(
                        event="cleanup_device_media_store_refresh_finished",
                        message="Da hoan tat refresh MediaStore sau delete",
                        step_key=STEP_CLEANUP_DEVICE,
                        meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                    )
            except Exception as refresh_exc:
                if auto_log_context is not None:
                    await auto_log_context.warning(
                        event="cleanup_device_media_store_refresh_failed",
                        message=f"Refresh MediaStore that bai: {refresh_exc}",
                        step_key=STEP_CLEANUP_DEVICE,
                        meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                    )

            is_deleted = await verify_device_file_deleted(
                device_id=payload.device_id,
                device_video_path=device_video_path,
                auto_log_context=auto_log_context,
            )
            if auto_log_context is not None:
                await (
                    auto_log_context.success(
                        event="cleanup_device_verify_deleted_succeeded",
                        message="Xac nhan file da khong con ton tai tren thiet bi",
                        step_key=STEP_CLEANUP_DEVICE,
                        meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                    )
                    if is_deleted
                    else auto_log_context.warning(
                        event="cleanup_device_verify_deleted_failed",
                        message="File van con xuat hien tren thiet bi sau cleanup",
                        step_key=STEP_CLEANUP_DEVICE,
                        meta={"deviceVideoPath": device_video_path, "deviceId": payload.device_id},
                    )
                )

            wait_after_delete_sec = float(TIMEOUT[STEP_CLEANUP_DEVICE].get("after_delete_wait_sec", 5.0))
            await asyncio.sleep(wait_after_delete_sec)
            if auto_log_context is not None:
                await auto_log_context.info(
                    event="cleanup_device_wait_after_delete_finished",
                    message="Da cho them sau cleanup de MediaStore/Shopee cap nhat",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"waitAfterDeleteSec": wait_after_delete_sec},
                )

            if auto_log_context is not None:
                await auto_log_context.info(
                    event="cleanup_device_deleted",
                    message="Đã xóa video khỏi thiết bị",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path, "waitAfterDeleteSec": wait_after_delete_sec},
                )
        except Exception as exc:
            if auto_log_context is not None:
                await auto_log_context.warning(
                    event="cleanup_device_delete_failed",
                    message=f"Xóa video khỏi thiết bị thất bại: {exc}",
                    step_key=STEP_CLEANUP_DEVICE,
                    meta={"deviceVideoPath": device_video_path},
                )
