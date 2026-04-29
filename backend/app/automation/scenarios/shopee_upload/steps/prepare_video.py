from __future__ import annotations

import asyncio
from pathlib import Path

from ..actions.device_file import (
    push_video_to_device,
    trigger_media_scan_with_retry,
    wait_for_device_file_exists,
)
from ..constants import (
    DEVICE_FILE_VERIFY_RETRY_COUNT,
    DEVICE_FILE_VERIFY_RETRY_DELAY_SECONDS,
    DEVICE_GALLERY_VIDEO_DIR,
    MEDIA_SCAN_RETRY_COUNT,
    MEDIA_SCAN_RETRY_DELAY_SECONDS,
    MEDIA_SCAN_WAIT_SECONDS,
    STEP_PREPARE_VIDEO,
)
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    local_video = Path(payload.local_video_path)
    video_name = payload.video_name or local_video.name

    if not local_video.exists() or local_video.name != video_name:
        parent = local_video.parent if local_video.parent.exists() else Path.cwd()
        candidate = parent / video_name
        if candidate.exists():
            local_video = candidate

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_resolve_started",
            message=f"Tìm video theo videoId={payload.video_id} và name={video_name}",
            step_key=STEP_PREPARE_VIDEO,
            meta={"videoId": payload.video_id, "videoName": video_name},
        )

    if not local_video.exists():
        if auto_log_context is not None:
            await auto_log_context.error(
                event="prepare_video_resolve_failed",
                message=f"Không tìm thấy video: {video_name}",
                step_key=STEP_PREPARE_VIDEO,
                meta={"videoId": payload.video_id, "videoName": video_name},
            )
        raise FileNotFoundError(f"Video not found for videoId={payload.video_id}, name={video_name}")

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_resolved",
            message=f"Đã tìm thấy video: {local_video.name}",
            step_key=STEP_PREPARE_VIDEO,
            meta={"videoPath": str(local_video)},
        )

    local_size = local_video.stat().st_size
    suffix = local_video.suffix or ".mp4"
    device_video_name = f"{payload.video_id}{suffix}".replace("/", "_")
    device_video_path = payload.device_video_path or f"{DEVICE_GALLERY_VIDEO_DIR}/{device_video_name}"
    payload.device_video_path = device_video_path
    payload.extra["deviceVideoDir"] = DEVICE_GALLERY_VIDEO_DIR
    payload.extra["deviceVideoPath"] = device_video_path
    payload.extra["deviceVideoName"] = device_video_name
    payload.extra["resolvedLocalVideoPath"] = str(local_video)

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_push_started",
            message="Bắt đầu đẩy video vào thư viện trên thiết bị",
            step_key=STEP_PREPARE_VIDEO,
            meta={
                "localVideoPath": str(local_video),
                "deviceVideoPath": device_video_path,
            },
        )

    await push_video_to_device(
        device_id=payload.device_id,
        local_video_path=str(local_video),
        device_video_path=device_video_path,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_verify_started",
            message="Kiem tra nhanh file tren thiet bi bang ls -l",
            step_key=STEP_PREPARE_VIDEO,
            meta={"deviceVideoPath": device_video_path, "localSize": local_size},
        )

    await wait_for_device_file_exists(
        device_id=payload.device_id,
        device_video_path=device_video_path,
        retry_count=DEVICE_FILE_VERIFY_RETRY_COUNT,
        retry_delay_sec=DEVICE_FILE_VERIFY_RETRY_DELAY_SECONDS,
        expected_size=local_size,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_verify_succeeded",
            message="Đã xác nhận file tồn tại trên thiết bị",
            step_key=STEP_PREPARE_VIDEO,
            meta={"deviceVideoPath": device_video_path},
        )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_media_scan_started",
            message="Bắt đầu gửi yêu cầu quét MediaStore",
            step_key=STEP_PREPARE_VIDEO,
            meta={"deviceVideoPath": device_video_path},
        )

    await trigger_media_scan_with_retry(
        device_id=payload.device_id,
        device_video_path=device_video_path,
        retry_count=MEDIA_SCAN_RETRY_COUNT,
        retry_delay_sec=MEDIA_SCAN_RETRY_DELAY_SECONDS,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_media_scan_succeeded",
            message="Đã gửi yêu cầu quét MediaStore",
            step_key=STEP_PREPARE_VIDEO,
            meta={"deviceVideoPath": device_video_path},
        )

    await asyncio.sleep(MEDIA_SCAN_WAIT_SECONDS)

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_media_scan_wait_finished",
            message="Đã chờ MediaStore cập nhật",
            step_key=STEP_PREPARE_VIDEO,
            meta={"waitSec": MEDIA_SCAN_WAIT_SECONDS},
        )

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_succeeded",
            message="Đã đẩy video vào thư viện thiết bị và gửi yêu cầu cập nhật MediaStore",
            step_key=STEP_PREPARE_VIDEO,
            meta={
                "videoId": payload.video_id,
                "videoName": video_name,
                "localVideoPath": str(local_video),
                "deviceVideoPath": device_video_path,
                "deviceVideoDir": DEVICE_GALLERY_VIDEO_DIR,
            },
        )
