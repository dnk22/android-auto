from __future__ import annotations

from pydantic import BaseModel, Field


class DeviceActionSchema(BaseModel):
    action: str
    x: int | None = None
    y: int | None = None


class BroadcastActionSchema(BaseModel):
    action: str
    x: int | None = None
    y: int | None = None
    only_connected: bool = Field(default=True)
