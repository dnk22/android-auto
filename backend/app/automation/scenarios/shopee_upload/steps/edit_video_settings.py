from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext, click_first_match

from ..constants import STEP_EDIT_VIDEO_SETTINGS, TIMEOUT
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if payload.connection is None:
        raise RuntimeError("Device connection is not available")

    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_EDIT_VIDEO_SETTINGS,
        auto_log_context=auto_log_context,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="edit_video_settings_started",
            message="Bắt đầu chỉnh sửa video và thêm nhạc",
            step_key=STEP_EDIT_VIDEO_SETTINGS,
        )

    await asyncio.sleep(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.IMPROVE_VIDEO_BUTTON,
        label="improve video button",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.ADD_MUSIC_BUTTON,
        label="add music button",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.SELECT_MUSIC_FIRST_ITEM,
        label="select first music item in list",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
    await asyncio.to_thread(payload.connection.press, "back")

    if auto_log_context is not None:
        await auto_log_context.success(
            event="edit_video_settings_back_succeeded",
            message="Đã quay lại sau khi chọn nhạc",
            step_key=STEP_EDIT_VIDEO_SETTINGS,
        )
        
    await asyncio.sleep(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.NEXT_BUTTON,
        label="next button after editing video settings",
        timeout_sec=8.0,
        ctx=ctx,
    )
    
    if auto_log_context is not None:
        await auto_log_context.success(
            event="edit_video_settings_succeeded",
            message="Đã chỉnh sửa video và thêm nhạc thành công",
            step_key=STEP_EDIT_VIDEO_SETTINGS,
        )