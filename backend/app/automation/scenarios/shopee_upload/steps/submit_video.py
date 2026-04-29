from __future__ import annotations

from ..actions.wait import wait_seconds
from ..constants import STEP_SUBMIT_VIDEO, TIMEOUT
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    _ = payload
    if auto_log_context is not None:
        await auto_log_context.info(
            event="submit_video_mock",
            message="Mock: bam dang video",
            step_key=STEP_SUBMIT_VIDEO,
        )

    await wait_seconds(TIMEOUT[STEP_SUBMIT_VIDEO]["wait_sec"])
