from __future__ import annotations

import asyncio
import contextlib
from typing import Optional

import httpx

from app.core.events import DeviceUpdateEvent
from app.core.locks import DeviceLocks
from app.models.common import LogType
from app.models.device import DeviceState, StreamStatus
from app.services.device.controller import DeviceController
from app.services.logging.logger import JsonLogger
from app.services.media.media_client import MediaClient
from app.services.media.scheduler import MediaScheduler
from app.services.ws.ws_manager import WSManager
from app.utils.time import is_stale, now_ts


class DeviceManager:
    def __init__(
        self,
        *,
        ws_manager: WSManager,
        media_client: MediaClient,
        media_scheduler: MediaScheduler,
        controller: DeviceController,
        logger: JsonLogger,
        stale_after_sec: float,
        disconnect_grace_sec: float,
    ) -> None:
        self._devices: dict[str, DeviceState] = {}
        self._locks = DeviceLocks()
        self._ws_manager = ws_manager
        self._media_client = media_client
        self._media_scheduler = media_scheduler
        self._controller = controller
        self._logger = logger
        self._stale_after_sec = stale_after_sec
        self._disconnect_grace_sec = disconnect_grace_sec
        self._disconnect_tasks: dict[str, asyncio.Task[None]] = {}

    def get_device(self, device_id: str) -> Optional[DeviceState]:
        return self._devices.get(device_id)

    def list_devices(self) -> list[DeviceState]:
        return list(self._devices.values())

    async def update_adb_state(self, device_id: str, connected: bool) -> None:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None:
                device = DeviceState(device_id=device_id)
                self._devices[device_id] = device

            previous = device.adb
            device.last_seen = now_ts()
            device.adb = connected

            if not connected:
                await self._cancel_disconnect_task(device_id)
                await self._stop_stream_immediate(device, reason="adb_unplug")
                self._enforce_invariants(device)
                await self._push_update(device)
                if previous:
                    self._logger.warning(
                        device_id=device_id,
                        type=LogType.ADB,
                        event="adb_disconnected",
                        message="ADB disconnected",
                    )
                return

            self._enforce_invariants(device)
            if not previous:
                self._logger.success(
                    device_id=device_id,
                    type=LogType.ADB,
                    event="adb_connected",
                    message="ADB connected",
                )
            await self._push_update(device)

    async def connect(self, device_id: str) -> DeviceState:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None:
                device = DeviceState(device_id=device_id)
                self._devices[device_id] = device

            if not device.adb:
                raise ValueError("Device is not connected via adb")

            await self._cancel_disconnect_task(device_id)

            device.u2 = True
            device.media_node_id = self._media_scheduler.pick_node(
                device_id,
                device.media_node_id,
                self.list_devices(),
            )
            device.stream = StreamStatus.STARTING
            await self._push_update(device)

            await self._media_client.start_stream(device_id, device.media_node_id)
            device.stream = StreamStatus.RUNNING
            device.last_seen = now_ts()

            self._logger.success(
                device_id=device_id,
                type=LogType.STREAM,
                event="start_stream",
                message="Stream started",
                meta={"node": device.media_node_id},
            )
            await self._push_update(device)
            return device

    async def disconnect(self, device_id: str) -> DeviceState:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None:
                device = DeviceState(device_id=device_id)
                self._devices[device_id] = device

            device.u2 = False
            self._enforce_invariants(device)
            await self._push_update(device)

            task = self._disconnect_tasks.get(device_id)
            if task:
                task.cancel()

            self._disconnect_tasks[device_id] = asyncio.create_task(self._delayed_stop(device_id))

            self._logger.info(
                device_id=device_id,
                type=LogType.U2,
                event="disconnect",
                message="Disconnect requested, stream stop delayed",
                meta={"grace_sec": self._disconnect_grace_sec},
            )
            return device

    async def ensure_stream(self, device_id: str) -> DeviceState:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None:
                device = DeviceState(device_id=device_id)
                self._devices[device_id] = device

            if not device.adb:
                raise ValueError("Device is not connected via adb")

            if not device.u2:
                device.u2 = True

            device.media_node_id = self._media_scheduler.pick_node(
                device_id,
                device.media_node_id,
                self.list_devices(),
            )

            if device.stream == StreamStatus.RUNNING:
                if self.is_stream_stale(device_id):
                    try:
                        await self._media_client.restart_stream(device_id, device.media_node_id)
                        device.last_frame_at = now_ts()
                        self._logger.warning(
                            device_id=device_id,
                            type=LogType.STREAM,
                            event="restart_stream",
                            message="Stream stale, restarted",
                        )
                    except httpx.TimeoutException as exc:
                        self._logger.warning(
                            device_id=device_id,
                            type=LogType.STREAM,
                            event="restart_stream_timeout",
                            message="Media restart timed out, checking stream status",
                            meta={"error": str(exc), "node": device.media_node_id},
                        )

                        try:
                            status = await self._media_client.stream_status(device_id, device.media_node_id)
                            if status.status == StreamStatus.RUNNING:
                                device.last_frame_at = now_ts()
                                await self._push_update(device)
                                return device
                        except Exception as status_error:
                            self._logger.error(
                                device_id=device_id,
                                type=LogType.STREAM,
                                event="stream_status_after_timeout_failed",
                                message="Failed to verify stream state after timeout",
                                meta={"error": str(status_error), "node": device.media_node_id},
                            )

                        raise RuntimeError("Media server restart timed out") from exc
                else:
                    status = await self._media_client.stream_status(device_id, device.media_node_id)
                    if status.lastFrameAt:
                        device.last_frame_at = float(status.lastFrameAt) / 1000.0
                await self._push_update(device)
                return device

            device.stream = StreamStatus.STARTING
            await self._push_update(device)
            await self._media_client.start_stream(device_id, device.media_node_id)
            device.stream = StreamStatus.RUNNING
            device.last_frame_at = now_ts()
            await self._push_update(device)
            return device

    async def stop_stream(self, device_id: str) -> DeviceState:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None:
                device = DeviceState(device_id=device_id)
                self._devices[device_id] = device
            await self._stop_stream_immediate(device, reason="manual_stop")
            await self._push_update(device)
            return device

    def is_stream_stale(self, device_id: str) -> bool:
        device = self._devices.get(device_id)
        if device is None:
            return True
        return is_stale(device.last_frame_at, self._stale_after_sec)

    async def perform_action(self, device_id: str, action: str) -> None:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None or not device.u2:
                raise ValueError("Device is not connected to u2")

            if action == "back":
                await self._controller.back(device_id)
                return
            if action == "home":
                await self._controller.home(device_id)
                return
            if action in ("recent", "recents"):
                await self._controller.recents(device_id)
                return

            raise ValueError(f"Unsupported action: {action}")

    async def perform_test_u2(self, device_id: str) -> None:
        async with self._locks.device(device_id):
            device = self._devices.get(device_id)
            if device is None or not device.u2:
                raise ValueError("Device is not connected to u2")
            await self._controller.test_u2(device_id)

    async def _delayed_stop(self, device_id: str) -> None:
        try:
            await asyncio.sleep(self._disconnect_grace_sec)
            async with self._locks.device(device_id):
                device = self._devices.get(device_id)
                if device is None:
                    return
                if device.u2:
                    return
                await self._stop_stream_immediate(device, reason="disconnect_grace_elapsed")
                await self._push_update(device)
        except asyncio.CancelledError:
            return
        finally:
            self._disconnect_tasks.pop(device_id, None)

    async def _cancel_disconnect_task(self, device_id: str) -> None:
        task = self._disconnect_tasks.pop(device_id, None)
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

    async def _stop_stream_immediate(self, device: DeviceState, reason: str) -> None:
        if device.media_node_id and device.stream != StreamStatus.STOPPED:
            try:
                await self._media_client.stop_stream(device.device_id, device.media_node_id)
            except Exception as exc:
                self._logger.error(
                    device_id=device.device_id,
                    type=LogType.STREAM,
                    event="stop_stream_error",
                    message="Failed to stop stream",
                    meta={"reason": reason, "error": str(exc)},
                )
        device.stream = StreamStatus.STOPPED
        device.last_frame_at = None
        self._enforce_invariants(device)

    def _enforce_invariants(self, device: DeviceState) -> None:
        if not device.adb:
            device.u2 = False
            device.stream = StreamStatus.STOPPED
        if not device.u2:
            device.stream = StreamStatus.STOPPED
        if device.stream == StreamStatus.RUNNING and not device.u2:
            device.stream = StreamStatus.STOPPED

    async def _push_update(self, device: DeviceState) -> None:
        event = DeviceUpdateEvent(deviceId=device.device_id, state=device)
        await self._ws_manager.broadcast(event)
