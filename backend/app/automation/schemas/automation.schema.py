from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.automation.models.sheet_model import SheetConfig, SheetRow
from app.automation.models.job_model import AutomationJob


class UpdateSheetRowRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    products: str | None = None
    device_id: str | None = Field(default=None, alias="deviceId")
    hashtag_inline: str | None = Field(default=None, alias="hashtagInline")
    meta: dict[str, Any] | None = None


class UpdateSheetConfigRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    hashtag_common: str | None = Field(default=None, alias="hashtagCommon")
    auto_ready: bool | None = Field(default=None, alias="autoReady")


class SheetResponse(BaseModel):
    rows: list[SheetRow]
    config: SheetConfig


class SetReadyResponse(BaseModel):
    ok: bool
    row: SheetRow


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
    files: list[str]


class JobResponse(BaseModel):
    ok: bool
    job: AutomationJob
