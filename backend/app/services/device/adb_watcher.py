from __future__ import annotations

import asyncio

from app.models.common import LogType
from app.services.device.device_manager import DeviceManager
from app.services.logging.logger import JsonLogger


class AdbWatcher:
    def __init__(self, manager: DeviceManager, logger: JsonLogger, poll_interval_sec: float) -> None:
        self._manager = manager
        self._logger = logger
        self._poll_interval_sec = poll_interval_sec
        self._task: asyncio.Task[None] | None = None
        self._running = False

    async def start(self) -> None:
        if self._task:
            return
        self._running = True
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_loop(self) -> None:
        while self._running:
            try:
                devices = await self._fetch_adb_devices()
                await self._reconcile(devices)
            except Exception as exc:
                self._logger.error(
                    device_id=None,
                    type=LogType.ADB,
                    event="adb_watcher_error",
                    message="ADB watcher iteration failed",
                    meta={"error": str(exc)},
                )
            await asyncio.sleep(self._poll_interval_sec)

    async def _fetch_adb_devices(self) -> set[str]:
        process = await asyncio.create_subprocess_exec(
            "adb",
            "devices",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="ignore").strip() or "adb command failed")

        lines = stdout.decode("utf-8", errors="ignore").splitlines()
        detected: set[str] = set()
        for line in lines[1:]:
            line = line.strip()
            if not line or "\t" not in line:
                continue
            serial, status = line.split("\t", 1)
            if status == "device":
                detected.add(serial)
        return detected

    async def _reconcile(self, detected: set[str]) -> None:
        current = {d.device_id for d in self._manager.list_devices() if d.adb}

        added = detected - current
        removed = current - detected

        for device_id in added:
            await self._manager.update_adb_state(device_id, True)

        for device_id in removed:
            await self._manager.update_adb_state(device_id, False)
