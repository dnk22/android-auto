from fastapi import APIRouter, HTTPException

from app.services.device_manager import device_manager
from app.models.schemas import ConnectRequest, DeviceListResponse

router = APIRouter()


@router.post("/connect")
async def connect_device(req: ConnectRequest) -> dict:
    try:
        state = await device_manager.connect_u2(req.device_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"device_id": state["id"]}


@router.post("/disconnect")
async def disconnect_device(req: ConnectRequest) -> dict:
    try:
        state = await device_manager.disconnect_u2(req.device_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"device_id": state["id"]}


@router.post("/connect-all")
async def connect_all_devices() -> dict:
    try:
        states = await device_manager.connect_all()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"count": len(states)}


@router.post("/u2/test-open-settings")
async def test_u2_open_settings(req: ConnectRequest) -> dict:
    try:
        state = await device_manager.open_settings_for_test(req.device_id)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "device_id": state["id"],
        "message": "Settings app opened",
    }


@router.get("/devices", response_model=DeviceListResponse)
async def list_devices() -> DeviceListResponse:
    return DeviceListResponse(devices=device_manager.list_device_states())
