from __future__ import annotations

from app.automation.device.u2 import UiActionContext, click_first_match

from ..actions.wait import wait_seconds
from ..constants import STEP_SUBMIT_VIDEO, TIMEOUT
from ..exceptions import PauseRequiredException
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if payload.connection is None:
        raise RuntimeError("Device connection is not available")

    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_SUBMIT_VIDEO,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="submit_video_started",
            message="Bắt đầu bấm đăng video",
            step_key=STEP_SUBMIT_VIDEO,
            meta={
                "videoId": payload.video_id,
                "jobId": payload.job_id,
            },
        )

    await wait_seconds(TIMEOUT[STEP_SUBMIT_VIDEO]["wait_sec"])

    try:
        await click_first_match(
            payload.connection,
            ShopeeUiSelectors.SUBMIT_BUTTON,
            label="nút Đăng video",
            timeout_sec=10.0,
            ctx=ctx,
        )

    except Exception as exc:
        if auto_log_context is not None:
            await auto_log_context.error(
                event="submit_video_failed",
                message=f"Bấm đăng video thất bại: {exc}",
                step_key=STEP_SUBMIT_VIDEO,
                reason="submit_button_click_failed",
                meta={
                    "videoId": payload.video_id,
                    "jobId": payload.job_id,
                    "exceptionType": type(exc).__name__,
                    "error": str(exc),
                },
            )

        raise PauseRequiredException(
            "Không bấm được nút Đăng video, cần user kiểm tra thủ công",
            step_key=STEP_SUBMIT_VIDEO,
            reason="submit_button_click_failed",
            meta={
                "videoId": payload.video_id,
                "jobId": payload.job_id,
                "exceptionType": type(exc).__name__,
                "error": str(exc),
            },
        ) from exc

    await wait_seconds(TIMEOUT[STEP_SUBMIT_VIDEO]["wait_sec"])

    if auto_log_context is not None:
        await auto_log_context.success(
            event="submit_video_succeeded",
            message="Đã bấm nút Đăng video",
            step_key=STEP_SUBMIT_VIDEO,
            meta={
                "videoId": payload.video_id,
                "jobId": payload.job_id,
            },
        )