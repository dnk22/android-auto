from __future__ import annotations

import json
import logging
import random
import time
from dataclasses import asdict
from typing import Any

from .shopee_blockers import SHOPEE_BLOCKERS
from .shopee_blocker_guard_types import (
    Bounds,
    ClickPoint,
    ShopeeBlockerCloseResult,
    ShopeeBlockerDetectionResult,
    ShopeeBlockerGuardOptions,
)


_LOGGER = logging.getLogger(__name__)


def _now_ts_ms() -> int:
    return int(time.time() * 1000)


def log_shopee_blocker_guard(event: dict) -> None:
    """Log blocker guard events safely without crashing caller."""
    try:
        payload = {
            "source": "ShopeeBlockerGuard",
            "timestamp": _now_ts_ms(),
            **event,
        }
        _LOGGER.info(json.dumps(payload, ensure_ascii=False))
    except Exception:
        return


def _sleep_ms(value_ms: int) -> None:
    time.sleep(max(0, value_ms) / 1000.0)


def _safe_exists(element: Any) -> bool:
    try:
        return bool(element.exists(timeout=0.2))
    except TypeError:
        pass
    except Exception:
        return False

    try:
        return bool(element.exists)
    except Exception:
        return False


def _query_with_resource_id(device: Any, resource_id: str) -> Any | None:
    try:
        if hasattr(device, "find_by_resource_id"):
            return device.find_by_resource_id(resource_id)
        if hasattr(device, "findByResourceId"):
            return device.findByResourceId(resource_id)
    except Exception:
        return None

    try:
        return device(resourceId=resource_id)
    except Exception:
        return None


def _query_with_candidate(device: Any, candidate: dict[str, Any]) -> Any | None:
    try:
        if "resource_id_matches" in candidate:
            return device(resourceIdMatches=str(candidate["resource_id_matches"]))
        if "description_contains" in candidate:
            return device(descriptionContains=str(candidate["description_contains"]))
        if "text" in candidate:
            return device(text=str(candidate["text"]))
    except Exception:
        return None
    return None


def _extract_bounds_from_info(info: Any) -> Bounds | None:
    if not isinstance(info, dict):
        return None

    bounds = info.get("bounds")
    if isinstance(bounds, dict):
        try:
            return Bounds(
                left=int(bounds.get("left", 0)),
                top=int(bounds.get("top", 0)),
                right=int(bounds.get("right", 0)),
                bottom=int(bounds.get("bottom", 0)),
            )
        except Exception:
            return None

    if isinstance(bounds, (list, tuple)) and len(bounds) >= 4:
        try:
            left, top, right, bottom = [int(value) for value in bounds[:4]]
            return Bounds(left=left, top=top, right=right, bottom=bottom)
        except Exception:
            return None

    return None


def _extract_bounds(element: Any) -> Bounds | None:
    try:
        info = element.info
    except Exception:
        info = None

    parsed = _extract_bounds_from_info(info)
    if parsed is not None:
        return parsed

    try:
        maybe = element.bounds()
    except Exception:
        maybe = None

    if isinstance(maybe, dict):
        try:
            return Bounds(
                left=int(maybe.get("left", 0)),
                top=int(maybe.get("top", 0)),
                right=int(maybe.get("right", 0)),
                bottom=int(maybe.get("bottom", 0)),
            )
        except Exception:
            return None

    if isinstance(maybe, (list, tuple)) and len(maybe) >= 4:
        try:
            left, top, right, bottom = [int(value) for value in maybe[:4]]
            return Bounds(left=left, top=top, right=right, bottom=bottom)
        except Exception:
            return None

    return None


def _is_valid_bounds(bounds: Bounds) -> bool:
    return bounds.right > bounds.left and bounds.bottom > bounds.top


def _safe_click_xy(device: Any, x: int, y: int) -> None:
    if hasattr(device, "human_click"):
        device.human_click(x, y)
        return
    if hasattr(device, "humanClick"):
        device.humanClick(x, y)
        return
    device.click(x, y)


def _safe_click_element(device: Any, element: Any) -> bool:
    bounds = _extract_bounds(element)
    if bounds and _is_valid_bounds(bounds):
        x = random.randint(bounds.left + 2, max(bounds.left + 2, bounds.right - 2))
        y = random.randint(bounds.top + 2, max(bounds.top + 2, bounds.bottom - 2))
        _safe_click_xy(device, x, y)
        return True

    try:
        element.click()
        return True
    except Exception:
        return False


def _safe_dump_debug(device: Any) -> None:
    timestamp = int(time.time())
    try:
        if hasattr(device, "dump_hierarchy"):
            xml = device.dump_hierarchy()
            if isinstance(xml, str):
                with open(f"/tmp/shopee_blocker_dump_{timestamp}.xml", "w", encoding="utf-8") as f:
                    f.write(xml)
    except Exception:
        pass

    try:
        if hasattr(device, "screenshot"):
            maybe = device.screenshot()
            if hasattr(maybe, "save"):
                maybe.save(f"/tmp/shopee_blocker_dump_{timestamp}.png")
            elif isinstance(maybe, (bytes, bytearray)):
                with open(f"/tmp/shopee_blocker_dump_{timestamp}.png", "wb") as f:
                    f.write(bytes(maybe))
    except Exception:
        pass


def _find_by_resource_id_with_short(
    device: Any,
    *,
    full_resource_id: str | None,
    short_resource_id: str | None,
) -> tuple[Any | None, dict[str, Any] | None]:
    if full_resource_id:
        candidate = _query_with_resource_id(device, full_resource_id)
        if candidate is not None and _safe_exists(candidate):
            return candidate, {"resource_id": full_resource_id}

    if short_resource_id:
        candidate = _query_with_resource_id(device, short_resource_id)
        if candidate is not None and _safe_exists(candidate):
            return candidate, {"resource_id": short_resource_id}

    return None, None


def get_shopee_popup_banner_bounds(device: Any) -> Bounds | None:
    """Return bounds of Shopee promo popup banner if visible."""
    promo = SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]
    element, _ = _find_by_resource_id_with_short(
        device,
        full_resource_id=str(promo.get("anchor_resource_id") or ""),
        short_resource_id=str(promo.get("short_resource_id") or ""),
    )
    if element is None:
        return None

    bounds = _extract_bounds(element)
    if bounds is None or not _is_valid_bounds(bounds):
        return None
    return bounds


def find_generic_close_button(device: Any) -> Any | None:
    """Find the first visible generic close button candidate."""
    candidates = SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["candidates"]
    for selector in candidates:
        element = _query_with_candidate(device, selector)
        if element is not None and _safe_exists(element):
            return element
    return None


def close_promo_popup_by_anchor_bounds(
    device: Any,
    bounds: Bounds,
    options: ShopeeBlockerGuardOptions | None = None,
) -> ShopeeBlockerCloseResult:
    """Close promo popup by clicking random point near top-right of banner bounds."""
    _ = options
    width = bounds.right - bounds.left
    height = bounds.bottom - bounds.top
    if width < 100 or height < 100 or not _is_valid_bounds(bounds):
        return ShopeeBlockerCloseResult(
            status="failed",
            blocker_name=SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["name"],
            strategy="relative_top_right",
            selector_used={"resource_id": SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["anchor_resource_id"]},
            anchor_bounds=bounds,
            error="Invalid anchor bounds",
        )

    area = SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["relative_close_area"]
    x_min = bounds.right - int(area["x_from_right_min"])
    x_max = bounds.right - int(area["x_from_right_max"])
    y_min = bounds.top + int(area["y_from_top_min"])
    y_max = bounds.top + int(area["y_from_top_max"])

    if x_min > x_max:
        x_min, x_max = x_max, x_min
    if y_min > y_max:
        y_min, y_max = y_max, y_min

    x = random.randint(x_min, x_max)
    y = random.randint(y_min, y_max)

    try:
        _sleep_ms(random.randint(60, 180))
        _safe_click_xy(device, x, y)
        _sleep_ms(random.randint(100, 260))
    except Exception as exc:
        return ShopeeBlockerCloseResult(
            status="failed",
            blocker_name=SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["name"],
            strategy="relative_top_right",
            selector_used={"resource_id": SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["anchor_resource_id"]},
            anchor_bounds=bounds,
            click_point=ClickPoint(x=x, y=y),
            error=str(exc),
        )

    return ShopeeBlockerCloseResult(
        status="closed",
        blocker_name=SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["name"],
        strategy="relative_top_right",
        selector_used={"resource_id": SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]["anchor_resource_id"]},
        anchor_bounds=bounds,
        click_point=ClickPoint(x=x, y=y),
    )


def detect_shopee_blockers(device: Any) -> list[ShopeeBlockerDetectionResult]:
    """Detect visible Shopee blockers without clicking any element."""
    results: list[ShopeeBlockerDetectionResult] = []

    promo = SHOPEE_BLOCKERS["PROMO_POPUP_BANNER"]
    promo_element, promo_selector = _find_by_resource_id_with_short(
        device,
        full_resource_id=str(promo.get("anchor_resource_id") or ""),
        short_resource_id=str(promo.get("short_resource_id") or ""),
    )
    promo_bounds = _extract_bounds(promo_element) if promo_element is not None else None
    promo_visible = promo_element is not None and _safe_exists(promo_element)
    results.append(
        ShopeeBlockerDetectionResult(
            blocker_name=str(promo["name"]),
            selector_used=promo_selector or {"resource_id": promo.get("anchor_resource_id")},
            bounds=promo_bounds,
            visible=bool(promo_visible),
        )
    )

    overlay = SHOPEE_BLOCKERS["SHADOW_OVERLAY"]
    overlay_element, overlay_selector = _find_by_resource_id_with_short(
        device,
        full_resource_id=str(overlay.get("resource_id") or ""),
        short_resource_id=str(overlay.get("short_resource_id") or ""),
    )
    overlay_bounds = _extract_bounds(overlay_element) if overlay_element is not None else None
    overlay_visible = overlay_element is not None and _safe_exists(overlay_element)
    results.append(
        ShopeeBlockerDetectionResult(
            blocker_name=str(overlay["name"]),
            selector_used=overlay_selector or {"resource_id": overlay.get("resource_id")},
            bounds=overlay_bounds,
            visible=bool(overlay_visible),
        )
    )

    close_element = find_generic_close_button(device)
    close_visible = close_element is not None and _safe_exists(close_element)
    close_bounds = _extract_bounds(close_element) if close_element is not None else None
    results.append(
        ShopeeBlockerDetectionResult(
            blocker_name=str(SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["name"]),
            selector_used={"candidates": SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["candidates"]},
            bounds=close_bounds,
            visible=bool(close_visible),
        )
    )

    log_shopee_blocker_guard(
        {
            "action": "detect_blockers",
            "results": [
                {
                    "blocker_name": item.blocker_name,
                    "selector_used": item.selector_used,
                    "bounds": asdict(item.bounds) if item.bounds else None,
                    "visible": item.visible,
                }
                for item in results
            ],
        }
    )

    return results


def close_one_shopee_blocker(
    device: Any,
    options: ShopeeBlockerGuardOptions | None = None,
) -> ShopeeBlockerCloseResult:
    """Close one blocker if found by priority: promo anchor -> generic close button."""
    opts = options or ShopeeBlockerGuardOptions()

    try:
        promo_bounds = get_shopee_popup_banner_bounds(device)
        if promo_bounds is not None:
            result = close_promo_popup_by_anchor_bounds(device, promo_bounds, opts)
            log_shopee_blocker_guard(
                {
                    "action": "close_blocker_attempt",
                    "status": result.status,
                    "blocker_name": result.blocker_name,
                    "strategy": result.strategy,
                    "anchor_bounds": asdict(result.anchor_bounds) if result.anchor_bounds else None,
                    "click_point": asdict(result.click_point) if result.click_point else None,
                    "error": result.error,
                }
            )
            return result

        close_element = find_generic_close_button(device)
        if close_element is not None:
            clicked = _safe_click_element(device, close_element)
            if clicked:
                result = ShopeeBlockerCloseResult(
                    status="closed",
                    blocker_name=str(SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["name"]),
                    strategy="generic_close_button",
                    selector_used={"candidates": SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["candidates"]},
                )
                log_shopee_blocker_guard(
                    {
                        "action": "close_blocker_success",
                        "status": result.status,
                        "blocker_name": result.blocker_name,
                        "strategy": result.strategy,
                    }
                )
                return result

            return ShopeeBlockerCloseResult(
                status="failed",
                blocker_name=str(SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["name"]),
                strategy="generic_close_button",
                selector_used={"candidates": SHOPEE_BLOCKERS["GENERIC_CLOSE_BUTTON"]["candidates"]},
                error="Found generic close button but click failed",
            )

        result = ShopeeBlockerCloseResult(status="not_found")
        log_shopee_blocker_guard(
            {
                "action": "close_blocker_not_found",
                "status": result.status,
            }
        )
        return result

    except Exception as exc:
        result = ShopeeBlockerCloseResult(status="failed", error=str(exc))
        log_shopee_blocker_guard(
            {
                "action": "close_blocker_failed",
                "status": result.status,
                "error": result.error,
            }
        )
        return result


def close_shopee_blockers_if_any(
    device: Any,
    options: ShopeeBlockerGuardOptions | None = None,
) -> int:
    """Close blockers in bounded attempts and return how many were closed."""
    opts = options or ShopeeBlockerGuardOptions()
    closed_count = 0

    max_attempts = max(1, int(opts.max_close_attempts))
    min_sleep = int(opts.after_close_sleep_ms_min)
    max_sleep = int(opts.after_close_sleep_ms_max)
    if min_sleep > max_sleep:
        min_sleep, max_sleep = max_sleep, min_sleep

    for _ in range(max_attempts):
        result = close_one_shopee_blocker(device, opts)

        if opts.enable_log:
            log_shopee_blocker_guard(
                {
                    "action": "close_blocker_attempt",
                    "status": result.status,
                    "blocker_name": result.blocker_name,
                    "strategy": result.strategy,
                    "selector_used": result.selector_used,
                    "anchor_bounds": asdict(result.anchor_bounds) if result.anchor_bounds else None,
                    "click_point": asdict(result.click_point) if result.click_point else None,
                    "error": result.error,
                }
            )

        if result.status == "closed":
            closed_count += 1
            _sleep_ms(random.randint(min_sleep, max_sleep))
            continue

        if result.status == "not_found":
            break

        if result.status == "failed":
            if opts.dump_on_failed_close:
                _safe_dump_debug(device)
            break

    return closed_count
