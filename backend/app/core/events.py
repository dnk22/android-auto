from __future__ import annotations

from pydantic import BaseModel

from app.models.device import DeviceState


class DeviceUpdateEvent(BaseModel):
    type: str = "DEVICE_UPDATE"
    deviceId: str
    state: DeviceState
