from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


JobStatus = Literal["queued", "running", "stopped", "done", "error"]


class AutomationJob(BaseModel):
    jobId: str
    videoId: str
    deviceId: str
    status: JobStatus
    createdAt: float
