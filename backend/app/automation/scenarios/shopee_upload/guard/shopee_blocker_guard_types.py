from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Bounds:
    left: int
    top: int
    right: int
    bottom: int


@dataclass(frozen=True)
class ClickPoint:
    x: int
    y: int


@dataclass
class ShopeeBlockerCloseResult:
    status: str
    blocker_name: str | None = None
    strategy: str | None = None
    selector_used: dict | None = None
    anchor_bounds: Bounds | None = None
    click_point: ClickPoint | None = None
    error: str | None = None


@dataclass
class ShopeeBlockerDetectionResult:
    blocker_name: str
    selector_used: dict
    bounds: Bounds | None
    visible: bool


@dataclass
class ShopeeBlockerGuardOptions:
    max_close_attempts: int = 2
    after_close_sleep_ms_min: int = 200
    after_close_sleep_ms_max: int = 500
    enable_log: bool = True
    dump_on_failed_close: bool = False
