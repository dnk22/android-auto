from __future__ import annotations

import asyncio

from app.automation.device.u2 import UiActionContext, click_first_match, exists

from ..guard import close_shopee_blockers_if_any
from ..constants import STEP_OPEN_UPLOAD_FLOW
from ..exceptions import PauseRequiredException
from ..payload import ShopeeUploadPayload
from ..ui_selectors import ShopeeUiSelectors


_PROFILE_DASHBOARD_MIN_MARKERS = 2


async def _is_on_profile_upload_dashboard(
    payload: ShopeeUploadPayload,
    auto_log_context=None,
) -> bool:
    if payload.connection is None:
        return False

    markers = ShopeeUiSelectors.PROFILE_UPLOAD_DASHBOARD_MARKERS
    matched = 0

    for selector in markers:
        try:
            if await exists(payload.connection, selector, timeout_sec=0.35):
                matched += 1
        except Exception:
            continue

    required = min(_PROFILE_DASHBOARD_MIN_MARKERS, len(markers))
    is_on_dashboard = len(markers) > 0 and matched >= required

    if auto_log_context is not None:
        await auto_log_context.info(
            event="open_upload_flow_profile_dashboard_check",
            message="Đã kiểm tra trạng thái Profile Upload Dashboard",
            step_key=STEP_OPEN_UPLOAD_FLOW,
            meta={
                "matchedMarkers": matched,
                "totalMarkers": len(markers),
                "requiredMarkers": required,
                "isOnDashboard": is_on_dashboard,
            },
        )

    return is_on_dashboard


async def run(payload: ShopeeUploadPayload, auto_log_context=None) -> None:
    if auto_log_context is not None:
        await auto_log_context.info(
            event="open_upload_flow_started",
            message="Mở app Shopee và vào tab Video/Live",
            step_key=STEP_OPEN_UPLOAD_FLOW,
        )

    if payload.connection is None:
        raise RuntimeError("Device connection is not available")

    if await _is_on_profile_upload_dashboard(payload, auto_log_context):
        if auto_log_context is not None:
            await auto_log_context.success(
                event="open_upload_flow_skipped",
                message="Đang ở Profile Upload Dashboard, bỏ qua bước điều hướng",
                step_key=STEP_OPEN_UPLOAD_FLOW,
            )
        return

    await asyncio.to_thread(payload.connection.app_start, "com.shopee.vn", stop=False)
    await asyncio.sleep(3.0)

    closed_count = await asyncio.to_thread(
        close_shopee_blockers_if_any,
        payload.connection,
    )

    if auto_log_context is not None:
        await auto_log_context.info(
            event="open_upload_flow_guard_checked",
            message="Đã check/close blocker trước khi thao tác tab",
            step_key=STEP_OPEN_UPLOAD_FLOW,
            meta={"closedCount": closed_count},
        )

    # Check lại sau khi mở app và đóng blocker.
    if await _is_on_profile_upload_dashboard(payload, auto_log_context):
        if auto_log_context is not None:
            await auto_log_context.success(
                event="open_upload_flow_skipped_after_app_start",
                message="Shopee đã ở Profile Upload Dashboard sau khi mở app",
                step_key=STEP_OPEN_UPLOAD_FLOW,
            )
        return

    ctx = UiActionContext(
        device_id=payload.device_id,
        step_key=STEP_OPEN_UPLOAD_FLOW,
        auto_log_context=auto_log_context,
    )

    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.VIDEO_TAB,
        label="icon Live/Video ở bottom bar",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(3.0)

    await click_first_match(
        payload.connection,
        ShopeeUiSelectors.PROFILE_TAB,
        label="tab Profile ở bottom bar",
        timeout_sec=8.0,
        ctx=ctx,
    )

    await asyncio.sleep(2.0)

    if not await _is_on_profile_upload_dashboard(payload, auto_log_context):
        raise PauseRequiredException(
            "Không xác nhận được màn Profile Upload Dashboard sau khi điều hướng",
            step_key=STEP_OPEN_UPLOAD_FLOW,
            reason="profile_upload_dashboard_not_found",
            meta={
                "screen": "profile_upload_dashboard",
            },
        )

    if auto_log_context is not None:
        await auto_log_context.success(
            event="open_upload_flow_succeeded",
            message="Đã vào Profile Upload Dashboard",
            step_key=STEP_OPEN_UPLOAD_FLOW,
        )