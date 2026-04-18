from __future__ import annotations

import asyncio

from app.models.common import LogType
from app.services.logging.logger import JsonLogger


class DeviceController:
    def __init__(self, logger: JsonLogger) -> None:
        self._logger = logger

    async def back(self, device_id: str) -> None:
        await self._send_keyevent(device_id, 4, "back")

    async def home(self, device_id: str) -> None:
        await self._send_keyevent(device_id, 3, "home")

    async def recents(self, device_id: str) -> None:
        await self._send_keyevent(device_id, 187, "recents")

    async def _send_keyevent(self, device_id: str, key_code: int, action: str) -> None:
        await self._run_adb_command(
            device_id,
            ["shell", "input", "keyevent", str(key_code)],
        )
        self._logger.info(
            device_id=device_id,
            type=LogType.CONTROL,
            event=action,
            message="Keyevent command accepted",
            meta={"keyCode": key_code},
        )

    async def _run_adb_command(self, device_id: str, adb_args: list[str]) -> None:
        process = await asyncio.create_subprocess_exec(
            "adb",
            "-s",
            device_id,
            *adb_args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _stdout, stderr = await process.communicate()
        if process.returncode != 0:
            message = stderr.decode("utf-8", errors="ignore").strip() or "adb command failed"
            raise ValueError(message)
