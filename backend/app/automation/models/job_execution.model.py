from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from app.automation.constants.automation_constants import EXECUTION_STATUSES


ExecutionStatus = Literal[*EXECUTION_STATUSES]


class JobExecution(BaseModel):
    id: str
    jobId: str
    videoId: str
    videoName: str | None = None
    scenarioName: str = "upload_shopee_video"
    requestedDevice: str | None = None
    assignedDevice: str | None = None
    status: ExecutionStatus
    attemptNo: int = 1
    priority: int = 0
    startedAt: int | None = None
    finishedAt: int | None = None
    errorMessage: str | None = None
    resultMeta: str | None = None
    createdAt: int
    updatedAt: int
