from __future__ import annotations

from ..actions.wait import wait_seconds
from ..constants import STEP_EDIT_VIDEO_SETTINGS, TIMEOUT
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    _ = payload
    if auto_log_context is not None:
        await auto_log_context.info(
            event="edit_video_settings_mock",
            message="Mock: chinh sua video va them nhac",
            step_key=STEP_EDIT_VIDEO_SETTINGS,
        )

    await wait_seconds(TIMEOUT[STEP_EDIT_VIDEO_SETTINGS]["wait_sec"])
