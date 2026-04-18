from __future__ import annotations

import time
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class StreamStatus(str, Enum):
    STOPPED = "STOPPED"
    STARTING = "STARTING"
    RUNNING = "RUNNING"
    ERROR = "ERROR"


class DeviceState(BaseModel):
    device_id: str

    adb: bool = False
    u2: bool = False

    stream: StreamStatus = StreamStatus.STOPPED

    media_node_id: Optional[str] = None

    last_seen: float = Field(default_factory=time.time)
    last_frame_at: Optional[float] = None
