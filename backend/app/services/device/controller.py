from __future__ import annotations

from app.models.common import LogType
from app.services.logging.logger import JsonLogger


class DeviceController:
    def __init__(self, logger: JsonLogger) -> None:
        self._logger = logger

    async def tap(self, device_id: str, x: int, y: int) -> None:
        self._logger.info(
            device_id=device_id,
            type=LogType.CONTROL,
            event="tap",
            message="Tap command accepted",
            meta={"x": x, "y": y},
        )
