from __future__ import annotations

from ..actions.wait import wait_seconds
from ..constants import STEP_SELECT_VIDEO
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    _ = payload
    if auto_log_context is not None:
        await auto_log_context.info(
            event="select_video_mock",
            message="Mock: chon video dau tien trong thu vien",
            step_key=STEP_SELECT_VIDEO,
        )

    await wait_seconds(0.3)
