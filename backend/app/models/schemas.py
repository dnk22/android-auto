from pydantic import BaseModel


class ConnectRequest(BaseModel):
    device_id: str


class StartJobRequest(BaseModel):
    device_id: str | None = None


class DeviceInfo(BaseModel):
    id: str
    adb_status: str
    u2_status: str
    connected: bool
    u2_alive: bool
    state: str
    last_seen: float


class DeviceListResponse(BaseModel):
    devices: list[DeviceInfo]


class JobResponse(BaseModel):
    job_id: str
    status: str
