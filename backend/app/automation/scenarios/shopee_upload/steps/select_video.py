from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext, click_first_match

from ..constants import STEP_SELECT_VIDEO, TIMEOUT
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if payload.connection is None:
        raise RuntimeError("Device connection is not available")

    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_SELECT_VIDEO,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="select_video_started",
            message="Bat dau luong chon video",
            step_key=STEP_SELECT_VIDEO,
        )

    await asyncio.sleep(TIMEOUT[STEP_SELECT_VIDEO]["before_upload_button_wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.UPLOAD_VIDEO_BUTTON,
        label="upload video button",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_SELECT_VIDEO]["after_upload_button_wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.BOX_SELECT_FROM_GALLERY,
        label="box select from gallery",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_SELECT_VIDEO]["after_gallery_select_wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.FIRST_VIDEO_IN_PICKER,
        label="first video in picker",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_SELECT_VIDEO]["after_first_video_wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.NEXT_BUTTON,
        label="next button",
        timeout_sec=8.0,
        ctx=ctx,
    )
