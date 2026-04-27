from __future__ import annotations

import os
from pathlib import Path

from pydantic import BaseModel, Field


class SheetStatus:
    IDLE = "idle"
    READY = "ready"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    DONE = "done"
    ERROR = "error"
    MISSING_FILE = "missing_file"


class ExecutionStatus:
    PENDING = "pending"
    ASSIGNED = "assigned"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    DONE = "done"
    ERROR = "error"


SHEET_ITEM_STATUSES = (
    SheetStatus.IDLE,
    SheetStatus.READY,
    SheetStatus.QUEUED,
    SheetStatus.RUNNING,
    SheetStatus.PAUSED,
    SheetStatus.STOPPED,
    SheetStatus.DONE,
    SheetStatus.ERROR,
    SheetStatus.MISSING_FILE,
)

EXECUTION_STATUSES = (
    ExecutionStatus.PENDING,
    ExecutionStatus.ASSIGNED,
    ExecutionStatus.RUNNING,
    ExecutionStatus.PAUSED,
    ExecutionStatus.STOPPED,
    ExecutionStatus.DONE,
    ExecutionStatus.ERROR,
)


class AutomationSettings(BaseModel):
    storage_dir: Path
    ready_debounce_sec: float = Field(default=5.0, ge=0.0)
    dispatcher_poll_interval_sec: float = Field(default=1.0, ge=0.1)
    watcher_debounce_sec: float = Field(default=0.3, ge=0.0)
    u2_timeout_sec: float = Field(default=30.0, ge=1.0)


def load_automation_settings() -> AutomationSettings:
    storage_raw = os.getenv("AUTOMATION_STORAGE_DIR")
    storage_dir = Path(storage_raw).expanduser().resolve() if storage_raw else Path.cwd() / "storage"

    return AutomationSettings(
        storage_dir=storage_dir,
        ready_debounce_sec=float(os.getenv("AUTOMATION_READY_DEBOUNCE_SEC", "5")),
        dispatcher_poll_interval_sec=float(os.getenv("AUTOMATION_DISPATCHER_POLL_INTERVAL_SEC", "1.0")),
        watcher_debounce_sec=float(os.getenv("AUTOMATION_WATCHER_DEBOUNCE_SEC", "0.3")),
        u2_timeout_sec=float(os.getenv("AUTOMATION_U2_TIMEOUT_SEC", "30")),
    )
