from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext, click_first_match

from ..constants import STEP_SELECT_VIDEO
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

    await asyncio.sleep(3.0)
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.UPLOAD_VIDEO_BUTTON,
        label="upload video button",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(3.0)
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.BOX_SELECT_FROM_GALLERY,
        label="box select from gallery",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(3.0)
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.FIRST_VIDEO_IN_PICKER,
        label="first video in picker",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(2.0)
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.NEXT_BUTTON,
        label="next button",
        timeout_sec=8.0,
        ctx=ctx,
    )
