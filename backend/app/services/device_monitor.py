import asyncio
from typing import Dict

from app.services.device_manager import device_manager
from app.services.websocket_manager import WebSocketManager


def parse_track_devices_snapshot(lines: list[str]) -> Dict[str, str]:
    snapshot: Dict[str, str] = {}
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("List of devices attached"):
            continue
        if "\t" not in line:
            continue
        device_id, status = line.split("\t", 1)
        snapshot[device_id.strip()] = status.strip()
    return snapshot


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

    async def adb_event_listener(self) -> None:
        process = await asyncio.create_subprocess_exec(
            "adb",
            "track-devices",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        if process.stdout is None:
            return

        block: list[str] = []
        while True:
            line = await process.stdout.readline()
            if not line:
                break

            decoded = line.decode("utf-8", errors="replace").rstrip("\n")
            if decoded.strip() == "":
                snapshot = parse_track_devices_snapshot(block)
                block = []
                await self.on_snapshot(snapshot)
                continue

            block.append(decoded)

        await process.wait()

    async def run(self) -> None:
        await self.on_snapshot(device_manager.list_adb_devices_with_status())
        while True:
            try:
                await self.adb_event_listener()
            except Exception:
                await asyncio.sleep(1)


device_monitor: DeviceMonitor | None = None
