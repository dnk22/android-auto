from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logger import log_hub
from app.services.device_manager import device_manager
from app.services.device_realtime import device_ws_manager

router = APIRouter()


@router.websocket("/ws/logs")
async def ws_logs(websocket: WebSocket) -> None:
    await log_hub.manager.connect(websocket)
    await log_hub.log("WebSocket client connected")
    try:
        while True:
            message = await websocket.receive_text()
            await log_hub.log(message)
    except WebSocketDisconnect:
        await log_hub.manager.disconnect(websocket)
    except Exception:
        await log_hub.manager.disconnect(websocket)


@router.websocket("/ws/devices")
async def ws_devices(websocket: WebSocket) -> None:
    await device_ws_manager.connect(websocket)
    await websocket.send_json(
        {
            "type": "device_snapshot",
            "data": device_manager.list_device_states(),
        }
    )
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await device_ws_manager.disconnect(websocket)
    except Exception:
        await device_ws_manager.disconnect(websocket)
