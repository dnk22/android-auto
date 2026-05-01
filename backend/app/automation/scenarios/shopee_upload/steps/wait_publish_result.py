from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext, click_first_match, exists
from ..constants import STEP_WAIT_PUBLISH_RESULT, TIMEOUT
from ..guard import close_shopee_blockers_if_any
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


async def _is_uploading(connection, auto_log_context=None) -> bool:
    """
    Check xem màn hình còn trạng thái đang tải/đang upload không.
    Mặc định ưu tiên check theo text_contains.
    """
    for selector in ShopeeUiSelectors.UPLOAD_LOADING_SELECTORS:
        try:
            found = await exists(
                connection,
                selector,
                timeout_sec=0.5,
            )
            if found:
                return True

        except Exception as exc:
            if auto_log_context is not None:
                await auto_log_context.warning(
                    event="wait_publish_result_upload_selector_failed",
                    message=f"Check selector trạng thái upload bị lỗi: {exc}",
                    step_key=STEP_WAIT_PUBLISH_RESULT,
                    meta={
                        "selector": repr(selector),
                        "selectorType": type(selector).__name__,
                    },
                )
            continue

    return False


async def _wait_until_upload_finished(
    payload: ShopeeUploadPayload,
    auto_log_context=None,
) -> None:
    """
    Mỗi 2s check trạng thái upload 1 lần.
    Nếu 3 lần liên tiếp không thấy phần tử đang tải/đang upload thì coi như upload đã xong.
    """
    max_wait_sec = float(
        payload.extra.get(
            "publish_wait_sec",
            TIMEOUT[STEP_WAIT_PUBLISH_RESULT]["after_video_upload_wait_sec"],
        )
    )

    check_interval_sec = 2.0
    missing_required_count = 2
    missing_count = 0
    elapsed_sec = 0.0

    if auto_log_context is not None:
        await auto_log_context.info(
            event="wait_publish_result_started",
            message="Bắt đầu theo dõi trạng thái đăng video",
            step_key=STEP_WAIT_PUBLISH_RESULT,
            meta={
                "maxWaitSec": max_wait_sec,
                "checkIntervalSec": check_interval_sec,
                "missingRequiredCount": missing_required_count,
            },
        )

    while elapsed_sec < max_wait_sec:
        is_uploading = await _is_uploading(payload.connection, auto_log_context)

        if auto_log_context is not None:
            await auto_log_context.info(
                event="wait_publish_result_check_uploading",
                message=(
                    "Vẫn thấy trạng thái đang tải/đang upload"
                    if is_uploading
                    else "Không thấy trạng thái đang tải/đang upload"
                ),
                step_key=STEP_WAIT_PUBLISH_RESULT,
                meta={
                    "elapsedSec": elapsed_sec,
                    "isUploading": is_uploading,
                    "missingCount": missing_count,
                },
            )

        if is_uploading:
            missing_count = 0
        else:
            missing_count += 1

            if missing_count >= missing_required_count:
                if auto_log_context is not None:
                    await auto_log_context.success(
                        event="wait_publish_result_upload_finished",
                        message="Không còn thấy trạng thái đang tải/đang upload, tiếp tục bước sau",
                        step_key=STEP_WAIT_PUBLISH_RESULT,
                        meta={
                            "elapsedSec": elapsed_sec,
                            "missingCount": missing_count,
                        },
                    )
                return

        await asyncio.sleep(check_interval_sec)
        elapsed_sec += check_interval_sec

    if auto_log_context is not None:
        await auto_log_context.info(
            event="wait_publish_result_timeout_reached",
            message="Đã hết thời gian chờ tối đa, tiếp tục bước sau",
            step_key=STEP_WAIT_PUBLISH_RESULT,
            meta={
                "maxWaitSec": max_wait_sec,
                "elapsedSec": elapsed_sec,
            },
        )


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_WAIT_PUBLISH_RESULT,
        auto_log_context=auto_log_context,
    )

    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.PROFILE_TAB,
        label="tab Profile ở trên cùng",
        timeout_sec=6.0,
        ctx=ctx,
    )

    await asyncio.sleep(TIMEOUT[STEP_WAIT_PUBLISH_RESULT]["wait_sec"])

    if auto_log_context is not None:
        await auto_log_context.success(
            event="open_upload_flow_succeeded",
            message="Đã vào Profile Upload Dashboard",
            step_key=STEP_WAIT_PUBLISH_RESULT,
        )
        
    await _wait_until_upload_finished(payload, auto_log_context)

    if auto_log_context is not None:
        await auto_log_context.success(
            event="wait_publish_result_succeeded",
            message="Đã chờ đăng video hoàn tất",
            step_key=STEP_WAIT_PUBLISH_RESULT,
        )

    # closed_count = await asyncio.to_thread(
    #     close_shopee_blockers_if_any,
    #     payload.connection,
    # )

    # if auto_log_context is not None:
    #     await auto_log_context.info(
    #         event="wait_publish_result_guard_checked",
    #         message="Đã check/close blocker trước khi thao tác",
    #         step_key=STEP_WAIT_PUBLISH_RESULT,
    #         meta={"closedCount": closed_count},
    #     )

    