from __future__ import annotations

from pydantic import BaseModel

from app.models.device import DeviceState


class DeviceListSchema(BaseModel):
    devices: list[DeviceState]
