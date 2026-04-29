from __future__ import annotations

import asyncio
import random
from typing import Any, Literal

from .actions import _log
from .exceptions import UiElementNotFoundError, UiScrollError
from .selectors import UiActionContext, UiSelector
from .wait import sleep_jitter


async def scroll(
    d: Any,
    *,
    direction: Literal["up", "down", "left", "right"],
    distance_ratio: float = 0.55,
    segments: int = 2,
    duration_sec: float = 0.22,
    label: str | None = None,
    ctx: UiActionContext | None = None,
) -> None:
    try:
        width, height = await asyncio.to_thread(d.window_size)

        center_x = int(width * random.uniform(0.46, 0.54))
        center_y = int(height * random.uniform(0.46, 0.54))

        vertical_distance = int(height * distance_ratio)
        horizontal_distance = int(width * distance_ratio)

        if direction == "up":
            start = (center_x, int(height * 0.72))
            end = (center_x, int(height * 0.72) - vertical_distance)
        elif direction == "down":
            start = (center_x, int(height * 0.28))
            end = (center_x, int(height * 0.28) + vertical_distance)
        elif direction == "left":
            start = (int(width * 0.78), center_y)
            end = (int(width * 0.78) - horizontal_distance, center_y)
        elif direction == "right":
            start = (int(width * 0.22), center_y)
            end = (int(width * 0.22) + horizontal_distance, center_y)
        else:
            raise UiScrollError(f"Unsupported scroll direction: {direction}")

        await _log(
            ctx,
            "info",
            "ui_scroll_started",
            f"Dang cuon {direction}: {label or 'man hinh'}",
            direction=direction,
            segments=segments,
        )

        sx, sy = start
        ex, ey = end

        current_x, current_y = sx, sy
        total_segments = max(1, segments)
        for segment in range(1, total_segments + 1):
            next_x = int(sx + (ex - sx) * segment / total_segments)
            next_y = int(sy + (ey - sy) * segment / total_segments)

            jitter_x = random.randint(-8, 8)
            jitter_y = random.randint(-8, 8)

            await asyncio.to_thread(
                d.swipe,
                current_x,
                current_y,
                next_x + jitter_x,
                next_y + jitter_y,
                duration_sec,
            )

            current_x, current_y = next_x, next_y
            await sleep_jitter(0.12, 0.05)

        await _log(
            ctx,
            "success",
            "ui_scroll_succeeded",
            f"Da cuon {direction}: {label or 'man hinh'}",
            direction=direction,
            segments=segments,
        )

    except Exception as exc:
        await _log(
            ctx,
            "error",
            "ui_scroll_failed",
            f"Cuon that bai: {label or direction}",
            error=str(exc),
            direction=direction,
        )
        raise UiScrollError(f"Scroll failed: {exc}") from exc


async def scroll_until_visible(
    d: Any,
    selectors: list[UiSelector],
    *,
    direction: Literal["up", "down", "left", "right"] = "up",
    max_swipes: int = 5,
    label: str | None = None,
    ctx: UiActionContext | None = None,
) -> None:
    from .actions import exists

    for attempt in range(0, max_swipes + 1):
        for selector in selectors:
            if await exists(d, selector, timeout_sec=0.5):
                await _log(
                    ctx,
                    "success",
                    "ui_scroll_until_visible_succeeded",
                    f"Da thay phan tu: {label or 'UI element'}",
                    attempt=attempt,
                    selector=selector.to_meta(),
                )
                return

        if attempt < max_swipes:
            await scroll(
                d,
                direction=direction,
                label=f"tim {label or 'UI element'}",
                ctx=ctx,
            )

    await _log(
        ctx,
        "error",
        "ui_scroll_until_visible_failed",
        f"Khong tim thay sau khi cuon: {label or 'UI element'}",
        maxSwipes=max_swipes,
    )

    raise UiElementNotFoundError(
        f"Element not visible after scrolling: {label or selectors}",
    )
