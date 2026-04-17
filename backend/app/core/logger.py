from datetime import datetime, timezone

from app.core.websocket_manager import WebSocketManager


class LogHub:
    def __init__(self) -> None:
        self.manager = WebSocketManager()

    async def log(self, message: str) -> None:
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        payload = f"{timestamp} | {message}"
        await self.manager.broadcast(payload)


log_hub = LogHub()
