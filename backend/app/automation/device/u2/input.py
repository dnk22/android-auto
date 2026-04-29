from __future__ import annotations

import asyncio
from typing import Any

from .actions import _log, _pick_point_in_bounds, click_first_match, wait_for_element
from .exceptions import UiInputError
from .selectors import UiActionContext, UiSelector
from .wait import sleep_jitter


async def paste_text(
    d: Any,
    text: str,
    *,
    ctx: UiActionContext | None = None,
) -> None:
    await _log(
        ctx,
        "info",
        "ui_paste_started",
        "Dang dan noi dung tu clipboard",
        textLength=len(text),
    )

    try:
        if hasattr(d, "set_clipboard"):
            await asyncio.to_thread(d.set_clipboard, text)
        else:
            await asyncio.to_thread(lambda: setattr(d, "clipboard", text))

        await sleep_jitter(0.2, 0.08)

        try:
            await asyncio.to_thread(d.press, "paste")
        except Exception as exc:
            raise UiInputError(f"press('paste') failed: {exc}") from exc

        await _log(
            ctx,
            "success",
            "ui_paste_succeeded",
            "Da dan noi dung tu clipboard",
            textLength=len(text),
        )

    except Exception as exc:
        await _log(
            ctx,
            "warning",
            "ui_paste_failed",
            f"Dan clipboard that bai: {exc}",
            error=str(exc),
        )
        raise UiInputError(f"Paste text failed: {exc}") from exc


async def long_click_and_paste(
    d: Any,
    selectors: list[UiSelector],
    text: str,
    *,
    label: str | None = None,
    timeout_sec: float = 10.0,
    ctx: UiActionContext | None = None,
) -> None:
    try:
        await click_first_match(
            d,
            selectors,
            label=label,
            timeout_sec=timeout_sec,
            ctx=ctx,
        )

        if hasattr(d, "set_clipboard"):
            await asyncio.to_thread(d.set_clipboard, text)
        else:
            await asyncio.to_thread(lambda: setattr(d, "clipboard", text))

        await sleep_jitter(0.2, 0.08)

        obj = None
        last_selector = None
        for selector in selectors:
            try:
                obj = await wait_for_element(
                    d,
                    selector,
                    timeout_sec=1.5,
                    label=label,
                    ctx=ctx,
                )
                last_selector = selector
                break
            except Exception:
                continue

        if obj is None:
            raise UiInputError(f"Cannot find input for long click: {label}")

        info = await asyncio.to_thread(lambda: obj.info)
        bounds = info.get("bounds") if isinstance(info, dict) else None
        if not bounds:
            raise UiInputError(f"Cannot get bounds for input: {label}")

        x, y = _pick_point_in_bounds(bounds, padding_ratio=0.2)
        await asyncio.to_thread(d.long_click, x, y, 0.8)
        await sleep_jitter(0.3, 0.1)

        paste_selectors = [
            UiSelector(text="Dán"),
            UiSelector(text="Paste"),
            UiSelector(description_contains="Dán"),
            UiSelector(description_contains="Paste"),
        ]

        await click_first_match(
            d,
            paste_selectors,
            label="nut Dan/Paste",
            timeout_sec=3.0,
            ctx=ctx,
        )

        await _log(
            ctx,
            "success",
            "ui_long_click_paste_succeeded",
            f"Da dan noi dung vao {label or 'input'}",
            textLength=len(text),
            selector=last_selector.to_meta() if last_selector else None,
        )

    except Exception as exc:
        await _log(
            ctx,
            "error",
            "ui_long_click_paste_failed",
            f"Dan bang long click that bai: {label or 'input'}",
            error=str(exc),
        )
        raise UiInputError(f"Long click paste failed: {exc}") from exc


async def input_text_with_fallback(
    d: Any,
    selectors: list[UiSelector],
    text: str,
    *,
    mode: str = "paste",
    label: str | None = None,
    timeout_sec: float = 10.0,
    ctx: UiActionContext | None = None,
) -> None:
    await _log(
        ctx,
        "info",
        "ui_input_started",
        f"Dang nhap noi dung vao {label or 'input'}",
        mode=mode,
        textLength=len(text),
    )

    await click_first_match(
        d,
        selectors,
        label=label,
        timeout_sec=timeout_sec,
        ctx=ctx,
    )

    errors: list[str] = []

    if mode == "paste":
        try:
            await long_click_and_paste(
                d,
                selectors,
                text,
                label=label,
                timeout_sec=timeout_sec,
                ctx=ctx,
            )
            return
        except Exception as exc:
            errors.append(f"paste={exc}")

    try:
        obj = None
        for selector in selectors:
            try:
                obj = await wait_for_element(
                    d,
                    selector,
                    timeout_sec=1.5,
                    label=label,
                    ctx=ctx,
                )
                break
            except Exception:
                continue

        if obj is None:
            raise UiInputError(f"Cannot find input for set_text: {label}")

        await asyncio.to_thread(obj.set_text, text)

        await _log(
            ctx,
            "success",
            "ui_input_set_text_succeeded",
            f"Da nhap noi dung bang set_text vao {label or 'input'}",
            textLength=len(text),
        )
        return

    except Exception as exc:
        errors.append(f"set_text={exc}")

    raise UiInputError(
        f"Input text failed for {label or 'input'}; " + "; ".join(errors),
    )
