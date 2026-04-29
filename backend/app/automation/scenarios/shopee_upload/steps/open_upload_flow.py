from __future__ import annotations

import asyncio

from ..actions.popup import dismiss_popups_if_any
from ..actions.wait import wait_seconds
from ..constants import STEP_OPEN_UPLOAD_FLOW
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if auto_log_context is not None:
        await auto_log_context.info(
            event="open_upload_flow_mock",
            message="Mock: mo Shopee va vao man dang video",
            step_key=STEP_OPEN_UPLOAD_FLOW,
        )

    if payload.connection is not None:
        await asyncio.to_thread(payload.connection.app_start, "com.shopee.vn", stop=True)

    await wait_seconds(1.0)

    # Future:
    # await dismiss_popups_if_any(...)
    _ = dismiss_popups_if_any
