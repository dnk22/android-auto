from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.control_schema import BroadcastActionSchema, DeviceActionSchema



def build_router(device_manager):
    router = APIRouter(tags=["control"])

    @router.post("/devices/{device_id}/action")
    async def device_action(device_id: str, payload: DeviceActionSchema):
        if payload.action != "tap":
            raise HTTPException(status_code=400, detail="Unsupported action")
        if payload.x is None or payload.y is None:
            raise HTTPException(status_code=400, detail="x and y are required for tap")

        try:
            await device_manager.perform_tap(device_id, payload.x, payload.y)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return {"ok": True, "message": "tap_sent"}

    @router.post("/devices/broadcast-action")
    async def broadcast_action(payload: BroadcastActionSchema):
        if payload.action != "tap":
            raise HTTPException(status_code=400, detail="Unsupported action")
        if payload.x is None or payload.y is None:
            raise HTTPException(status_code=400, detail="x and y are required for tap")

        sent = 0
        for device in device_manager.list_devices():
            if payload.only_connected and not device.u2:
                continue
            try:
                await device_manager.perform_tap(device.device_id, payload.x, payload.y)
                sent += 1
            except ValueError:
                continue

        return {"ok": True, "message": "broadcast_sent", "count": sent}

    return router
