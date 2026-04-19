from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


SheetStatus = Literal[
    "idle",
    "queued",
    "ready",
    "running",
    "paused",
    "stopped",
    "done",
    "error",
    "missing_file",
]

class SheetRow(BaseModel):
    id: str
    videoId: str
    videoName: str
    deviceId: str
    products: str
    hashtagInline: str | None = None
    createdByDuplicate: bool = False
    status: SheetStatus
    meta: str | None = None
    version: int = 0
    startedAt: int | None = None
    finishedAt: int | None = None
    createdAt: int
    updatedAt: int


class SessionState(BaseModel):
    status: Literal["watching", "idle"] = "idle"
    autoReady: bool = False


class SheetState(BaseModel):
    rows: list[SheetRow] = Field(default_factory=list)
