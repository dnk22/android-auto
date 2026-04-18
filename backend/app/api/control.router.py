from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.control_schema import BroadcastActionSchema, DeviceActionSchema



def build_router(device_manager):
    router = APIRouter(tags=["control"])

    key_actions = {"back", "home", "recent", "recents"}

    @router.post("/devices/{device_id}/action")
    async def device_action(device_id: str, payload: DeviceActionSchema):
        if payload.action in key_actions:
            try:
                await device_manager.perform_action(device_id, payload.action)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc

            return {"ok": True, "message": f"{payload.action}_sent"}

        raise HTTPException(status_code=400, detail="Unsupported action")

    @router.post("/devices/broadcast-action")
    async def broadcast_action(payload: BroadcastActionSchema):
        if payload.action not in key_actions:
            raise HTTPException(status_code=400, detail="Unsupported action")

        sent = 0
        for device in device_manager.list_devices():
            if payload.only_connected and not device.u2:
                continue
            try:
                await device_manager.perform_action(device.device_id, payload.action)
                sent += 1
            except ValueError:
                continue

        return {"ok": True, "message": "broadcast_sent", "count": sent}

    return router
