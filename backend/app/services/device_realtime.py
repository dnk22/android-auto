from app.services.websocket_manager import WebSocketManager


device_ws_manager = WebSocketManager()


async def broadcast_device_update(state: dict) -> None:
    await device_ws_manager.broadcast({"type": "device_update", "data": state})
