from __future__ import annotations

import time
import uuid
from enum import Enum
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


class LogLevel(str, Enum):
    INFO = "INFO"
    ERROR = "ERROR"
    WARNING = "WARNING"
    SUCCESS = "SUCCESS"


class LogType(str, Enum):
    ADB = "ADB"
    U2 = "U2"
    STREAM = "STREAM"
    CONTROL = "CONTROL"


class LogRecord(BaseModel):
    ts: int = Field(default_factory=lambda: int(time.time()))
    level: LogLevel
    type: LogType
    event: str
    message: str
    device_id: Optional[str] = None
    meta: dict[str, Any] = Field(default_factory=dict)


SystemLogLevel = Literal["debug", "info", "success", "warning", "error"]
SystemLogService = Literal["orchestrator", "automation", "media", "unknown"]


def normalize_log_level(level: str | None) -> SystemLogLevel:
    value = str(level or "info").strip().lower()
    if value == "debug":
        return "debug"
    if value == "success":
        return "success"
    if value in {"warn", "warning"}:
        return "warning"
    if value == "error":
        return "error"
    return "info"


def normalize_component(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip().lower()
    if not normalized:
        return None

    mapping = {
        "adb": "adb",
        "u2": "u2",
        "stream": "stream",
        "control": "control",
        "device": "device",
        "device_manager": "device_manager",
    }
    return mapping.get(normalized, normalized)


class SystemLogEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ts: int = Field(default_factory=lambda: int(time.time() * 1000))

    service: SystemLogService = "orchestrator"
    component: Optional[str] = None

    level: SystemLogLevel = "info"

    event: str
    message: str

    deviceId: Optional[str] = None

    meta: dict[str, Any] = Field(default_factory=dict)
    raw: Optional[Any] = None


class SystemLogWsMessage(BaseModel):
    type: Literal["system_log"] = "system_log"
    payload: SystemLogEvent
