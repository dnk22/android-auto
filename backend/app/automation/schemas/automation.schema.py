from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.automation.models.sheet_model import SessionState, SheetRow, SheetStatus
from app.automation.models.job_model import AutomationJob


class UpdateSheetRowRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    products: str | None = None
    device_id: str | None = Field(default=None, alias="deviceId")
    hashtag_inline: str | None = Field(default=None, alias="hashtagInline")
    status: str | None = None
    meta: str | dict[str, Any] | None = None
    version: int | None = None
    started_at: int | None = Field(default=None, alias="startedAt")
    finished_at: int | None = Field(default=None, alias="finishedAt")


SheetResponse = list[SheetRow]


class BulkUpdateSheetRequest(BaseModel):
    rows: list[SheetRow]


class SetReadyResponse(BaseModel):
    ok: bool
    row: SheetRow


class UpdateSheetStatusRequest(BaseModel):
    status: SheetStatus


class UpdateSessionRequest(BaseModel):
    status: Literal["watching", "idle"] | None = None
    autoReady: bool | None = None
    hashtagCommon: str | None = None


class SessionResponse(BaseModel):
    status: Literal["watching", "idle"]
    autoReady: bool
    hashtagCommon: str | None = None
    isVideoFolderCreated: bool
    videoFolderPath: str | None = None


class CreateVideoFolderRequest(BaseModel):
    isDesktop: bool = False


class CreateVideoFolderResponse(BaseModel):
    ok: bool
    isDesktop: bool
    path: str
    isVideoFolderCreated: bool


class RenameFileRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    video_name: str = Field(alias="videoName")
    new_name: str | None = Field(default=None, alias="newName")


class RenameFileResponse(BaseModel):
    ok: bool
    from_name: str = Field(alias="from")
    to_name: str = Field(alias="to")
    created_by_duplicate: bool = Field(alias="createdByDuplicate")


class StorageListResponse(BaseModel):
    wsUrl: str
    videoFolderPath: str | None = None
    rows: list[SheetRow]


class OpenVideoFolderResponse(BaseModel):
    ok: bool
    path: str


class JobResponse(BaseModel):
    ok: bool
    job: AutomationJob


class AutoLogExecutionSummary(BaseModel):
    id: str
    jobId: str
    videoId: str
    status: str
    assignedDevice: str | None = None
    startedAt: int | None = None
    finishedAt: int | None = None


class AutoLogStep(BaseModel):
    id: int
    executionId: str
    stepIndex: int
    stepKey: str
    stepName: str
    stepType: str | None = None
    status: str
    deviceId: str | None = None
    startedAt: int | None = None
    finishedAt: int | None = None
    durationMs: int | None = None
    errorMessage: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
    createdAt: int
    updatedAt: int


class AutoLogEvent(BaseModel):
    id: int
    executionId: str
    stepId: int | None = None
    jobId: str | None = None
    videoId: str | None = None
    deviceId: str | None = None
    level: str
    event: str
    message: str
    stepIndex: int | None = None
    stepKey: str | None = None
    stepName: str | None = None
    source: str | None = None
    component: str | None = None
    reason: str | None = None
    meta: dict[str, Any] = Field(default_factory=dict)
    screenshotPath: str | None = None
    createdAt: int


class ExecutionAutoLogResponse(BaseModel):
    execution: AutoLogExecutionSummary | None = None
    steps: list[AutoLogStep] = Field(default_factory=list)
    logs: list[AutoLogEvent] = Field(default_factory=list)
