from __future__ import annotations

from typing import Optional

from pydantic import BaseModel

from app.models.device import DeviceState, StreamStatus


class HealthResponse(BaseModel):
    ok: bool
    service: str


class StreamResponse(BaseModel):
    wsUrl: str
    status: StreamStatus


class ActionResult(BaseModel):
    ok: bool
    message: str


class DeviceListResponse(BaseModel):
    devices: list[DeviceState]


class DeviceUpdatePayload(BaseModel):
    type: str
    deviceId: str
    state: DeviceState


class StreamStatusPayload(BaseModel):
    device_id: str
    exists: bool
    status: str
    clients: int
    lastFrameAt: Optional[int] = None
    thumbnailAt: Optional[int] = None
