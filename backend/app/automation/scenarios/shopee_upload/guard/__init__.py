from __future__ import annotations

from .shopee_blockers import SHOPEE_BLOCKERS
from .shopee_blocker_guard_types import (
    Bounds,
    ClickPoint,
    ShopeeBlockerCloseResult,
    ShopeeBlockerDetectionResult,
    ShopeeBlockerGuardOptions,
)
from .shopee_blocker_guard import (
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
