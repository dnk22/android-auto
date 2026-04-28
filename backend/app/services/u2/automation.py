from __future__ import annotations

import asyncio
import time

from app.services.logging.logger import JsonLogger


class U2AutomationService:
    def __init__(self, logger: JsonLogger) -> None:
        self._logger = logger

    async def test_open_settings_then_home(self, device_id: str, delay_sec: float = 1.0) -> None:
        try:
            await asyncio.to_thread(self._run_sequence, device_id, delay_sec)
        except Exception as exc:
            raise ValueError(f"uiautomator2 test failed: {exc}") from exc

    def _run_sequence(self, device_id: str, delay_sec: float) -> None:
        import uiautomator2 as u2

        device = u2.connect(device_id)
        device.app_start("com.android.settings", stop=False)
        self._logger.info(
            component="u2",
            deviceId=device_id,
            event="u2_test_started",
            message="Opened Android settings for U2 test via uiautomator2",
        )

        time.sleep(max(0.0, delay_sec))
        device.press("home")
        self._logger.info(
            component="u2",
            deviceId=device_id,
            event="u2_test_finished",
            message="Returned home for U2 test via uiautomator2",
        )
