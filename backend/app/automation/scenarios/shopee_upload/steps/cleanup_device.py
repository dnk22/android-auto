from __future__ import annotations

import asyncio

from ..actions.device_file import delete_device_file, trigger_media_scan
from ..actions.wait import wait_seconds
from ..constants import STEP_CLEANUP_DEVICE
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if auto_log_context is not None:
        await auto_log_context.info(
            event="cleanup_device_mock",
            message="Mock: xoa video khoi thiet bi va ve home",
            step_key=STEP_CLEANUP_DEVICE,
        )

    if payload.connection is not None:
        try:
            await asyncio.to_thread(payload.connection.press, "home")
        except Exception:
            pass

    await wait_seconds(0.3)

    # Future:
    # await delete_device_file(...)
    # await trigger_media_scan(...)
    _ = (delete_device_file, trigger_media_scan)
