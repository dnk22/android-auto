import asyncio
from typing import Dict

from app.services.device_manager import device_manager
from app.services.websocket_manager import WebSocketManager
class DeviceMonitor:
    def __init__(self, ws_manager: WebSocketManager) -> None:
        self.ws_manager = ws_manager
        self._last_signature: Dict[str, tuple[str, str, bool, str]] = {}

    async def _broadcast_changes(self) -> None:
        states = device_manager.list_device_states()
        for state in states:
            signature = (
                str(state["adb_status"]),
                str(state["u2_status"]),
                bool(state["connected"]),
                str(state["state"]),
            )
            previous = self._last_signature.get(state["id"])
            if signature != previous:
                self._last_signature[state["id"]] = signature
                await self.ws_manager.broadcast(
                    {"type": "device_update", "data": state}
                )

    async def on_snapshot(self, snapshot: Dict[str, str]) -> None:
        device_manager.set_adb_snapshot(snapshot)
        await self._broadcast_changes()

    async def poll_devices(self) -> None:
        await self.on_snapshot(device_manager.list_adb_devices_with_status())

    async def run(self) -> None:
        await self.on_snapshot(device_manager.list_adb_devices_with_status())
        while True:
            try:
                await self.poll_devices()
            except Exception:
                pass

            await asyncio.sleep(1)


device_monitor: DeviceMonitor | None = None
