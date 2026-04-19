from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


SheetStatus = Literal["idle", "ready", "running", "done", "error", "missing_file"]


class SheetRow(BaseModel):
    videoId: str
    videoName: str
    products: str
    status: SheetStatus
    createdByDuplicate: bool = False
    deviceId: str
    hashtagInline: str | None = None
    meta: dict[str, Any] | None = None


class SheetConfig(BaseModel):
    hashtagCommon: str | None = None
    autoReady: bool = False


class SheetState(BaseModel):
    rows: list[SheetRow] = Field(default_factory=list)
    config: SheetConfig = Field(default_factory=SheetConfig)
