from __future__ import annotations

import asyncio
import random
import time
from typing import Any

from .exceptions import UiElementNotFoundError
from .selectors import UiActionContext, UiSelector
from .wait import sleep_jitter


def _query(d: Any, selector: UiSelector) -> Any:
    if selector.xpath:
        return d.xpath(selector.xpath)

    kwargs: dict[str, Any] = {}

    if selector.resource_id:
        kwargs["resourceId"] = selector.resource_id
    if selector.text:
        kwargs["text"] = selector.text
    if selector.text_contains:
        kwargs["textContains"] = selector.text_contains
    if selector.description:
        kwargs["description"] = selector.description
    if selector.description_contains:
        kwargs["descriptionContains"] = selector.description_contains
    if selector.class_name:
        kwargs["className"] = selector.class_name

    obj = d(**kwargs)

    if selector.index is not None:
        obj = obj[selector.index]

    return obj


async def _log(ctx: UiActionContext | None, level: str, event: str, message: str, **meta) -> None:
    if ctx is None or ctx.auto_log_context is None:
        return

    log = ctx.auto_log_context
    payload_meta = dict(meta)
    step_key = ctx.step_key

    if level == "debug" and hasattr(log, "debug"):
        await log.debug(event=event, message=message, step_key=step_key, meta=payload_meta)
    elif level == "success" and hasattr(log, "success"):
        await log.success(event=event, message=message, step_key=step_key, meta=payload_meta)
    elif level == "warning" and hasattr(log, "warning"):
        await log.warning(event=event, message=message, step_key=step_key, meta=payload_meta)
    elif level == "error" and hasattr(log, "error"):
        await log.error(event=event, message=message, step_key=step_key, meta=payload_meta)
    elif hasattr(log, "info"):
        await log.info(event=event, message=message, step_key=step_key, meta=payload_meta)


async def exists(
    d: Any,
    selector: UiSelector,
    *,
    timeout_sec: float = 2.0,
) -> bool:
    obj = _query(d, selector)
    try:
        return bool(await asyncio.to_thread(obj.exists, timeout=timeout_sec))
    except TypeError:
        started = time.monotonic()
        while time.monotonic() - started <= timeout_sec:
            if bool(await asyncio.to_thread(obj.exists)):
                return True
            await asyncio.sleep(0.15)
        return False


async def wait_for_element(
    d: Any,
    selector: UiSelector,
    *,
    timeout_sec: float = 10.0,
    interval_sec: float = 0.3,
    label: str | None = None,
    ctx: UiActionContext | None = None,
) -> Any:
    started = time.monotonic()

    await _log(
        ctx,
        "info",
        "ui_wait_element_started",
        f"Dang cho phan tu: {label or 'UI element'}",
        selector=selector.to_meta(),
        timeoutSec=timeout_sec,
    )

    while time.monotonic() - started <= timeout_sec:
        obj = _query(d, selector)
        try:
            ok = await asyncio.to_thread(obj.exists, timeout=0.1)
        except TypeError:
            ok = await asyncio.to_thread(obj.exists)
        if ok:
            await _log(
                ctx,
                "success",
                "ui_wait_element_succeeded",
                f"Da tim thay phan tu: {label or 'UI element'}",
                selector=selector.to_meta(),
            )
            return obj

        await asyncio.sleep(interval_sec)

    await _log(
        ctx,
        "error",
        "ui_wait_element_failed",
        f"Khong tim thay phan tu: {label or 'UI element'}",
        selector=selector.to_meta(),
        timeoutSec=timeout_sec,
    )

    raise UiElementNotFoundError(f"Element not found: {label or selector}")


def _pick_point_in_bounds(bounds: dict | tuple | list, *, padding_ratio: float = 0.18) -> tuple[int, int]:
    if isinstance(bounds, dict):
        left = int(bounds.get("left", 0))
        top = int(bounds.get("top", 0))
        right = int(bounds.get("right", 0))
        bottom = int(bounds.get("bottom", 0))
    else:
        left, top, right, bottom = [int(v) for v in bounds]

    width = max(1, right - left)
    height = max(1, bottom - top)

    pad_x = min(max(2, int(width * padding_ratio)), max(2, width // 2 - 1))
    pad_y = min(max(2, int(height * padding_ratio)), max(2, height // 2 - 1))

    min_x = left + pad_x
    max_x = max(min_x, right - pad_x)
    min_y = top + pad_y
    max_y = max(min_y, bottom - pad_y)

    x = random.randint(min_x, max_x)
    y = random.randint(min_y, max_y)

    return x, y


async def click(
    d: Any,
    selector: UiSelector,
    *,
    label: str | None = None,
    timeout_sec: float = 10.0,
    ctx: UiActionContext | None = None,
) -> None:
    obj = await wait_for_element(
        d,
        selector,
        timeout_sec=timeout_sec,
        label=label,
        ctx=ctx,
    )

    await _log(
        ctx,
        "info",
        "ui_click_started",
        f"Dang bam: {label or 'UI element'}",
        selector=selector.to_meta(),
    )

    try:
        info = await asyncio.to_thread(lambda: obj.info)
        bounds = info.get("bounds") if isinstance(info, dict) else None
        if not bounds:
            await asyncio.to_thread(obj.click)
            await sleep_jitter(0.2, 0.08)
            return

        x, y = _pick_point_in_bounds(bounds)
        await asyncio.to_thread(d.click, x, y)

        await _log(
            ctx,
            "success",
            "ui_click_succeeded",
            f"Da bam: {label or 'UI element'}",
            selector=selector.to_meta(),
            x=x,
            y=y,
            bounds=bounds,
        )

        await sleep_jitter(0.25, 0.1)

    except Exception as exc:
        await _log(
            ctx,
            "error",
            "ui_click_failed",
            f"Bam that bai: {label or 'UI element'}",
            selector=selector.to_meta(),
            error=str(exc),
        )
        raise


async def click_first_match(
    d: Any,
    selectors: list[UiSelector],
    *,
    label: str | None = None,
    timeout_sec: float = 10.0,
    ctx: UiActionContext | None = None,
) -> None:
    last_error: Exception | None = None

    for selector in selectors:
        try:
            await click(
                d,
                selector,
                label=label,
                timeout_sec=timeout_sec,
                ctx=ctx,
            )
            return
        except Exception as exc:
            last_error = exc
            continue

    raise UiElementNotFoundError(
        f"No selector matched for {label or 'UI element'}: {last_error}",
    )
