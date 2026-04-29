from __future__ import annotations

from pathlib import Path

from ..actions.device_file import push_video_to_device, trigger_media_scan
from ..constants import STEP_PREPARE_VIDEO
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
            message=f"Tim video theo videoId={payload.video_id} va name={video_name}",
            step_key=STEP_PREPARE_VIDEO,
            meta={"videoId": payload.video_id, "videoName": video_name},
        )

    if not local_video.exists():
        raise FileNotFoundError(f"Video not found for videoId={payload.video_id}, name={video_name}")

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_resolved",
            message=f"Da tim thay video: {local_video.name}",
            step_key=STEP_PREPARE_VIDEO,
            meta={"videoPath": str(local_video)},
        )

    device_video_dir = "/sdcard/Movies/AUTO_UPLOAD"
    device_video_path = payload.device_video_path or f"{device_video_dir}/{video_name}"
    payload.device_video_path = device_video_path
    payload.extra["deviceVideoDir"] = device_video_dir
    payload.extra["deviceVideoPath"] = device_video_path
    payload.extra["resolvedLocalVideoPath"] = str(local_video)

    if auto_log_context is not None:
        await auto_log_context.info(
            event="prepare_video_push_started",
            message="Bat dau day video vao thu vien tren thiet bi",
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
    await trigger_media_scan(
        device_id=payload.device_id,
        device_video_path=device_video_path,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.success(
            event="prepare_video_push_succeeded",
            message="Da day video vao thu vien thiet bi thanh cong",
            step_key=STEP_PREPARE_VIDEO,
            meta={
                "localVideoPath": str(local_video),
                "deviceVideoPath": device_video_path,
                "deviceVideoDir": device_video_dir,
            },
        )
