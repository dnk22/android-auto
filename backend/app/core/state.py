from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.services.device.adb_watcher import AdbWatcher
from app.services.device.controller import DeviceController
from app.services.device.device_manager import DeviceManager
from app.services.logging.logger import JsonLogger
from app.services.media.media_client import MediaClient
from app.services.media.scheduler import MediaScheduler
from app.services.ws.ws_manager import WSManager


@dataclass
class AppContainer:
    settings: Settings
    logger: JsonLogger
    ws_manager: WSManager
    media_client: MediaClient
    media_scheduler: MediaScheduler
    device_controller: DeviceController
    device_manager: DeviceManager
    adb_watcher: AdbWatcher
