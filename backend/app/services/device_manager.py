import asyncio
import time
from typing import Dict

import adbutils
import uiautomator2 as u2


def safe_get_device(device_id: str) -> u2.Device:
    device = u2.connect(device_id)
    try:
        _ = device.info
    except Exception:
        device.healthcheck()
    return device


class DeviceManager:
    def __init__(self) -> None:
        self.devices: Dict[str, dict] = {}
        self.u2_cache: Dict[str, tuple[float, str]] = {}
        self.u2_cache_ttl = 2.5
        self.last_connect_attempt: Dict[str, float] = {}
        self.connect_debounce_seconds = 5.0
        self.adb_snapshot: Dict[str, str] = {}

    def _now(self) -> float:
        return time.time()

    def _ensure_meta(self, device_id: str) -> dict:
        if device_id not in self.devices:
            self.devices[device_id] = {
                "id": device_id,
                "adb_status": "disconnected",
                "u2_status": "disconnected",
                "connected": False,
                "state": "DISCONNECTED",
                "last_seen": 0.0,
            }
        return self.devices[device_id]

    def _normalize_adb_status(self, raw: str) -> str:
        value = (raw or "").strip().lower()
        if value == "device":
            return "device"
        if "offline" in value:
            return "offline"
        if "unauthor" in value:
            return "unauthorized"
        if value:
            return value
        return "disconnected"

    def set_adb_snapshot(self, snapshot: Dict[str, str]) -> None:
        self.adb_snapshot = {
            device_id: self._normalize_adb_status(status)
            for device_id, status in snapshot.items()
        }

    def list_adb_devices(self) -> list[str]:
        if self.adb_snapshot:
            return list(self.adb_snapshot.keys())

        devices: list[str] = []
        try:
            for adb_device in adbutils.adb.device_list():
                serial = getattr(adb_device, "serial", None)
                if isinstance(serial, str):
                    devices.append(serial)
        except Exception:
            return []
        return devices

    def list_adb_devices_with_status(self) -> Dict[str, str]:
        if self.adb_snapshot:
            return dict(self.adb_snapshot)

        result: Dict[str, str] = {}
        try:
            for adb_device in adbutils.adb.device_list():
                serial = getattr(adb_device, "serial", None)
                if not isinstance(serial, str):
                    continue
                raw_state = str(
                    getattr(adb_device, "state", None)
                    or getattr(adb_device, "status", None)
                    or "device"
                )
                result[serial] = self._normalize_adb_status(raw_state)
        except Exception:
            return {}
        return result

    def get_adb_status(self, device_id: str) -> str:
        status = self.list_adb_devices_with_status().get(device_id)
        return status if status else "disconnected"

    def derive_state(self, adb_status: str, u2_status: str) -> str:
        if adb_status == "disconnected":
            return "DISCONNECTED"
        if adb_status != "device":
            return "DISCONNECTED"
        if u2_status == "connected":
            return "READY"
        if u2_status == "error":
            return "U2_ERROR"
        return "ADB_READY"

    def is_u2_alive(self, device_id: str, force_refresh: bool = False) -> bool:
        adb_status = self.get_adb_status(device_id)
        if adb_status != "device":
            self.u2_cache[device_id] = (self._now(), "disconnected")
            meta = self._ensure_meta(device_id)
            meta["u2_status"] = "disconnected"
            return False

        now = self._now()
        if not force_refresh and device_id in self.u2_cache:
            cached_at, cached_status = self.u2_cache[device_id]
            if now - cached_at <= self.u2_cache_ttl:
                return cached_status == "connected"

        u2_status = "disconnected"
        try:
            device = u2.connect(device_id)
            _ = device.info
            u2_status = "connected"
        except Exception:
            u2_status = "error"

        self.u2_cache[device_id] = (now, u2_status)
        meta = self._ensure_meta(device_id)
        meta["u2_status"] = u2_status
        if u2_status == "connected":
            meta["last_seen"] = now
        return u2_status == "connected"

    async def connect_u2(self, device_id: str) -> dict:
        now = self._now()
        last_attempt = self.last_connect_attempt.get(device_id, 0.0)
        if now - last_attempt < self.connect_debounce_seconds:
            return self.compute_device_state(device_id)

        self.last_connect_attempt[device_id] = now
        meta = self._ensure_meta(device_id)
        meta["u2_status"] = "connecting"

        adb_status = self.get_adb_status(device_id)
        if adb_status != "device":
            meta["adb_status"] = adb_status
            meta["u2_status"] = "disconnected"
            meta["state"] = self.derive_state(adb_status, meta["u2_status"])
            return self.compute_device_state(device_id)

        try:
            await asyncio.to_thread(safe_get_device, device_id)
            meta["connected"] = True
            meta["u2_status"] = "connected"
            meta["last_seen"] = self._now()
            self.u2_cache[device_id] = (self._now(), "connected")
        except Exception:
            meta["u2_status"] = "error"

        meta["adb_status"] = self.get_adb_status(device_id)
        meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])
        return self.compute_device_state(device_id)

    async def disconnect_u2(self, device_id: str) -> dict:
        meta = self._ensure_meta(device_id)
        meta["connected"] = False
        meta["u2_status"] = "disconnected"
        meta["adb_status"] = self.get_adb_status(device_id)
        meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])
        self.u2_cache.pop(device_id, None)
        return self.compute_device_state(device_id)

    async def open_settings_for_test(self, device_id: str) -> dict:
        meta = self._ensure_meta(device_id)
        adb_status = self.get_adb_status(device_id)
        if adb_status != "device":
            meta["adb_status"] = adb_status
            meta["u2_status"] = "disconnected"
            meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])
            raise RuntimeError(f"Device {device_id} is not available over ADB")

        def _open_settings() -> None:
            device = safe_get_device(device_id)
            device.app_start("com.android.settings")

        await asyncio.to_thread(_open_settings)
        now = self._now()
        meta["connected"] = True
        meta["u2_status"] = "connected"
        meta["adb_status"] = adb_status
        meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])
        meta["last_seen"] = now
        self.u2_cache[device_id] = (now, "connected")
        return self.compute_device_state(device_id)

    async def connect_all(self) -> list[dict]:
        adb_map = self.list_adb_devices_with_status()
        candidates = []
        for device_id, adb_status in adb_map.items():
            meta = self._ensure_meta(device_id)
            if adb_status == "device" and meta["u2_status"] != "connected":
                candidates.append(device_id)

        if not candidates:
            return self.list_device_states()

        await asyncio.gather(*(self.connect_u2(device_id) for device_id in candidates))
        return self.list_device_states()

    def get_device(self, device_id: str) -> u2.Device:
        device = safe_get_device(device_id)
        now = self._now()
        meta = self._ensure_meta(device_id)
        meta["connected"] = True
        meta["u2_status"] = "connected"
        meta["adb_status"] = self.get_adb_status(device_id)
        meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])
        meta["last_seen"] = now
        self.u2_cache[device_id] = (now, "connected")
        return device

    def compute_device_state(self, device_id: str) -> dict:
        meta = self._ensure_meta(device_id)
        adb_status = self.get_adb_status(device_id)

        if adb_status != "device":
            meta["u2_status"] = "disconnected"
            if adb_status == "disconnected":
                meta["connected"] = False
        elif meta["connected"]:
            self.is_u2_alive(device_id)

        meta["adb_status"] = adb_status
        meta["state"] = self.derive_state(meta["adb_status"], meta["u2_status"])

        if meta["u2_status"] == "connected":
            meta["last_seen"] = self._now()

        return {
            "id": device_id,
            "adb_status": meta["adb_status"],
            "u2_status": meta["u2_status"],
            "connected": bool(meta["connected"]),
            "state": meta["state"],
            "last_seen": float(meta["last_seen"]),
            "u2_alive": meta["u2_status"] == "connected",
        }

    def list_devices(self) -> list[str]:
        return list(self.list_adb_devices_with_status().keys())

    def list_device_states(self) -> list[dict]:
        return [self.compute_device_state(device_id) for device_id in self.list_devices()]


device_manager = DeviceManager()
