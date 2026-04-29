from __future__ import annotations

from ..actions.input_text import input_text_with_fallback
from ..actions.wait import wait_seconds
from ..constants import STEP_INPUT_HASHTAG
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if auto_log_context is not None:
        await auto_log_context.info(
            event="input_hashtag_mock",
            message="Mock: nhap hashtag/caption",
            step_key=STEP_INPUT_HASHTAG,
            meta={"hashtag": payload.hashtag},
        )

    await wait_seconds(0.3)

    # Future:
    # await input_text_with_fallback(...)
    _ = input_text_with_fallback
