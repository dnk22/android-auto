from __future__ import annotations

from app.automation.scenarios.shopee_upload.guard import SHOPEE_BLOCKERS
from app.automation.scenarios.shopee_upload.guard import (
    Bounds,
    ClickPoint,
    ShopeeBlockerCloseResult,
    ShopeeBlockerDetectionResult,
    ShopeeBlockerGuardOptions,
    close_shopee_blockers_if_any,
    close_one_shopee_blocker,
    detect_shopee_blockers,
    get_shopee_popup_banner_bounds,
    close_promo_popup_by_anchor_bounds,
    find_generic_close_button,
    log_shopee_blocker_guard,
)

__all__ = [
    "SHOPEE_BLOCKERS",
    "Bounds",
    "ClickPoint",
    "ShopeeBlockerCloseResult",
    "ShopeeBlockerDetectionResult",
    "ShopeeBlockerGuardOptions",
    "close_shopee_blockers_if_any",
    "close_one_shopee_blocker",
    "detect_shopee_blockers",
    "get_shopee_popup_banner_bounds",
    "close_promo_popup_by_anchor_bounds",
    "find_generic_close_button",
    "log_shopee_blocker_guard",
]
