from __future__ import annotations

from ..actions.wait import wait_seconds
from ..constants import STEP_WAIT_PUBLISH_RESULT, TIMEOUT
from ..payload import ShopeeUploadPayload


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    wait_sec = float(payload.extra.get("publish_wait_sec", TIMEOUT[STEP_WAIT_PUBLISH_RESULT]["default_wait_sec"]))

    if auto_log_context is not None:
        await auto_log_context.info(
            event="wait_publish_result_started",
            message=f"Dang cho ket qua dang video trong {wait_sec:.0f}s",
            step_key=STEP_WAIT_PUBLISH_RESULT,
            meta={"waitSec": wait_sec},
        )

    await wait_seconds(wait_sec)

    if auto_log_context is not None:
        await auto_log_context.success(
            event="wait_publish_result_succeeded",
            message="Da cho dang video hoan tat",
            step_key=STEP_WAIT_PUBLISH_RESULT,
        )
