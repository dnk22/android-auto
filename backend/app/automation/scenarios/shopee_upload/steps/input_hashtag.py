from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext
from app.automation.device.u2.input import input_text_with_fallback

from ..actions.wait import wait_seconds
from ..constants import STEP_INPUT_HASHTAG, TIMEOUT
from ..exceptions import PauseRequiredException
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if payload.connection is None:
        raise RuntimeError("Device connection is not available")

    hashtag_text = (payload.hashtag or "").strip()

    if not hashtag_text:
        raise PauseRequiredException(
            "Không có hashtag/caption để nhập, cần kiểm tra dữ liệu sheet",
            step_key=STEP_INPUT_HASHTAG,
            reason="missing_hashtag",
            meta={
                "videoId": payload.video_id,
                "jobId": payload.job_id,
            },
        )

    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_INPUT_HASHTAG,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="input_hashtag_started",
            message="Bắt đầu nhập hashtag/caption",
            step_key=STEP_INPUT_HASHTAG,
            meta={
                "videoId": payload.video_id,
                "hashtagLength": len(hashtag_text),
                "hashtagPreview": hashtag_text[:80],
            },
        )

    await wait_seconds(TIMEOUT[STEP_INPUT_HASHTAG]["wait_sec"])

    try:
        await input_text_with_fallback(
            payload.connection,
            ShopeeUiSelectors.HASHTAG_INPUT,
            hashtag_text,
            mode="paste",
            label="ô nhập hashtag/caption",
            timeout_sec=10.0,
            ctx=ctx,
        )

    except Exception as exc:
        if auto_log_context is not None:
            await auto_log_context.error(
                event="input_hashtag_failed",
                message=f"Nhập hashtag/caption thất bại: {exc}",
                step_key=STEP_INPUT_HASHTAG,
                reason="input_hashtag_failed",
                meta={
                    "videoId": payload.video_id,
                    "exceptionType": type(exc).__name__,
                    "error": str(exc),
                },
            )

        raise PauseRequiredException(
            "Không nhập được hashtag/caption, cần user kiểm tra thủ công",
            step_key=STEP_INPUT_HASHTAG,
            reason="input_hashtag_failed",
            meta={
                "videoId": payload.video_id,
                "exceptionType": type(exc).__name__,
                "error": str(exc),
            },
        ) from exc
        
    await asyncio.sleep(TIMEOUT[STEP_INPUT_HASHTAG]["wait_sec"])
    await asyncio.to_thread(payload.connection.press, "back")

    if auto_log_context is not None:
        await auto_log_context.success(
            event="input_hashtag_succeeded",
            message="Đã nhập hashtag/caption thành công",
            step_key=STEP_INPUT_HASHTAG,
            meta={
                "videoId": payload.video_id,
                "hashtagLength": len(hashtag_text),
            },
        )