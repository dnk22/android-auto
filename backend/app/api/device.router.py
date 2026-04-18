from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.device_schema import DeviceListSchema



def build_router(device_manager):
    router = APIRouter(tags=["device"])

    @router.get("/devices", response_model=DeviceListSchema)
    async def list_devices() -> DeviceListSchema:
        return DeviceListSchema(devices=device_manager.list_devices())

    @router.post("/devices/{device_id}/connect")
    async def connect_device(device_id: str):
        try:
            state = await device_manager.connect(device_id)
            return {"ok": True, "state": state}
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/devices/{device_id}/disconnect")
    async def disconnect_device(device_id: str):
        state = await device_manager.disconnect(device_id)
        return {"ok": True, "state": state}

    return router
