from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


class AutomationSettings(BaseModel):
    storage_dir: Path
    ready_debounce_sec: float = Field(default=5.0, ge=0.0)
    watcher_debounce_sec: float = Field(default=0.3, ge=0.0)
    u2_timeout_sec: float = Field(default=30.0, ge=1.0)


def load_automation_settings() -> AutomationSettings:
    storage_raw = os.getenv("AUTOMATION_STORAGE_DIR")
    storage_dir = Path(storage_raw).expanduser().resolve() if storage_raw else Path.cwd() / "storage"

    return AutomationSettings(
        storage_dir=storage_dir,
        ready_debounce_sec=float(os.getenv("AUTOMATION_READY_DEBOUNCE_SEC", "5")),
        watcher_debounce_sec=float(os.getenv("AUTOMATION_WATCHER_DEBOUNCE_SEC", "0.3")),
        u2_timeout_sec=float(os.getenv("AUTOMATION_U2_TIMEOUT_SEC", "30")),
    )
