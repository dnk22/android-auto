from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DeviceActionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str


class BroadcastActionSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    action: str
    only_connected: bool = Field(default=True)
