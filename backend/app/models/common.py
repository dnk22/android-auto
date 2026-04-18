from __future__ import annotations

import time
from enum import Enum
from typing import Any, Optional

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
