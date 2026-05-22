from __future__ import annotations

import asyncio

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
                    component="adb",
                    event="adb_watcher_error",
                    message="ADB watcher iteration failed",
                    meta={"error": str(exc)},
                )
            await asyncio.sleep(self._poll_interval_sec)

    async def _fetch_adb_devices(self) -> dict[str, str]:
        process = await asyncio.create_subprocess_exec(
            "adb",
            "devices",
            "-l",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(stderr.decode("utf-8", errors="ignore").strip() or "adb command failed")

        lines = stdout.decode("utf-8", errors="ignore").splitlines()
        detected: dict[str, str] = {}
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) < 2:
                continue
            serial = parts[0]
            status = parts[1]
            if status == "device":
                model_name = serial
                for token in parts[2:]:
                    if token.startswith("model:"):
                        model_name = token.split(":", 1)[1].replace("_", " ").strip() or serial
                        break
                detected[serial] = model_name
        return detected

    async def _reconcile(self, detected: dict[str, str]) -> None:
        current = {d.device_id for d in self._manager.list_devices() if d.adb}

        detected_ids = set(detected.keys())

        added = detected_ids - current
        removed = current - detected_ids

        for device_id in added:
            await self._manager.update_adb_state(device_id, True, detected.get(device_id))

        for device_id in (detected_ids & current):
            await self._manager.update_adb_state(device_id, True, detected.get(device_id))

        for device_id in removed:
            await self._manager.update_adb_state(device_id, False)
