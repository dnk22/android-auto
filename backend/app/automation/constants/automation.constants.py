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


class ExecutionLogLevel:
    DEBUG = "debug"
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class ExecutionStepStatus:
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    ERROR = "error"
    SKIPPED = "skipped"
    STOPPED = "stopped"


class StopReason:
    USER_REQUEST = "user_request"
    SHEET_STATUS_STOPPED = "sheet_status_stopped"
    EXECUTION_STATUS_STOPPED = "execution_status_stopped"
    DEVICE_DISCONNECTED = "device_disconnected"
    WORKER_CANCELLED = "worker_cancelled"
    APP_SHUTDOWN = "app_shutdown"
    BOT_REQUESTED_STOP = "bot_requested_stop"
    STEP_FAILED = "step_failed"
    UNKNOWN = "unknown"


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

EXECUTION_STEP_STATUSES = (
    ExecutionStepStatus.PENDING,
    ExecutionStepStatus.RUNNING,
    ExecutionStepStatus.DONE,
    ExecutionStepStatus.ERROR,
    ExecutionStepStatus.SKIPPED,
    ExecutionStepStatus.STOPPED,
)

EXECUTION_LOG_LEVELS = (
    ExecutionLogLevel.DEBUG,
    ExecutionLogLevel.INFO,
    ExecutionLogLevel.SUCCESS,
    ExecutionLogLevel.WARNING,
    ExecutionLogLevel.ERROR,
)

SHOPEE_UPLOAD_STEPS = (
    {"index": 1, "key": "prepare_video", "name": "Đẩy video vào thiết bị", "type": "adb"},
    {"index": 2, "key": "open_upload_flow", "name": "Mở màn đăng video", "type": "u2"},
    {"index": 3, "key": "select_video", "name": "Chọn video từ thư viện", "type": "u2"},
    {"index": 4, "key": "input_hashtag", "name": "Nhập hashtag", "type": "input"},
    {"index": 5, "key": "edit_video_settings", "name": "Chỉnh sửa video và thêm nhạc", "type": "u2"},
    {"index": 6, "key": "attach_products", "name": "Gắn sản phẩm", "type": "u2"},
    {"index": 7, "key": "submit_video", "name": "Đăng video", "type": "u2"},
    {"index": 8, "key": "wait_publish_result", "name": "Chờ đăng video hoàn tất", "type": "wait"},
    {"index": 9, "key": "cleanup_device", "name": "Dọn dẹp thiết bị", "type": "adb", "always_run": True},
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
