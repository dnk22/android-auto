from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DeviceActionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str


class BroadcastActionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str
    only_connected: bool = Field(default=True)


class TestU2Schema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    device_id: str | None = Field(default=None, alias="deviceId")
    sync_all: bool = Field(default=False, alias="syncAll")
