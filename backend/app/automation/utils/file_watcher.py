from __future__ import annotations

import asyncio
import time
from pathlib import Path

from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger

from watchdog.events import FileSystemEvent, FileSystemEventHandler, FileSystemMovedEvent
from watchdog.observers import Observer


class _StorageEventHandler(FileSystemEventHandler):
    def __init__(
        self,
        *,
        loop: asyncio.AbstractEventLoop,
        watch_path: Path,
        debounce_sec: float,
        storage_service,
        logger: AutomationSystemLogger,
    ) -> None:
        self._loop = loop
        self._watch_path = watch_path
        self._debounce_sec = debounce_sec
        self._storage_service = storage_service
        self._logger = logger
        self._last_event_by_key: dict[str, float] = {}

    def _schedule(self, coro) -> None:
        async def _wrapped() -> None:
            try:
                await asyncio.sleep(self._debounce_sec)
                await coro
            except asyncio.CancelledError:
                return
            except Exception as exc:  # noqa: BLE001
                self._logger.error(
                    component=AutomationLogComponent.WATCHER,
                    event="file_sync_failed",
                    message=f"Watcher task failed: {exc}",
                    meta={"error": str(exc)},
                )

        self._loop.call_soon_threadsafe(lambda: self._loop.create_task(_wrapped()))

    def _is_duplicate(self, key: str) -> bool:
        now = time.time()
        last = self._last_event_by_key.get(key)
        self._last_event_by_key[key] = now
        if last is None:
            return False
        return (now - last) <= self._debounce_sec

    def _is_inside_watch_path(self, path: Path) -> bool:
        try:
            path.relative_to(self._watch_path)
            return True
        except ValueError:
            return False

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        name = Path(event.src_path).name
        if self._storage_service.is_ignored_name(name) or not self._storage_service.is_video_file_name(name):
            return
        if self._is_duplicate(f"created:{name}"):
            return
        self._logger.info(
            component=AutomationLogComponent.WATCHER,
            event="file_created",
            message=f"Detected new video file: {name}",
            meta={"filename": name, "path": event.src_path},
        )
        self._schedule(self._storage_service.handle_file_created(name))

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        name = Path(event.src_path).name
        if self._storage_service.is_ignored_name(name) or not self._storage_service.is_video_file_name(name):
            return
        if self._is_duplicate(f"deleted:{name}"):
            return
        self._logger.info(
            component=AutomationLogComponent.WATCHER,
            event="file_deleted",
            message=f"Detected deleted video file: {name}",
            meta={"filename": name, "path": event.src_path},
        )
        self._schedule(self._storage_service.handle_file_deleted(name))

    def on_moved(self, event: FileSystemMovedEvent) -> None:
        if event.is_directory:
            return

        src_path = Path(event.src_path)
        dest_path = Path(event.dest_path)
        src_inside = self._is_inside_watch_path(src_path)
        dest_inside = self._is_inside_watch_path(dest_path)

        old_name = Path(event.src_path).name
        new_name = Path(event.dest_path).name

        # Move into watched folder => treat as created.
        if not src_inside and dest_inside:
            if self._storage_service.is_ignored_name(new_name):
                return
            if not self._storage_service.is_video_file_name(new_name):
                return
            if self._is_duplicate(f"created:{new_name}"):
                return
            self._logger.info(
                component=AutomationLogComponent.WATCHER,
                event="file_created",
                message=f"Detected new video file by move: {new_name}",
                meta={"filename": new_name, "path": event.dest_path},
            )
            self._schedule(self._storage_service.handle_file_created(new_name))
            return

        # Move out of watched folder => treat as deleted.
        if src_inside and not dest_inside:
            if self._storage_service.is_ignored_name(old_name):
                return
            if not self._storage_service.is_video_file_name(old_name):
                return
            if self._is_duplicate(f"deleted:{old_name}"):
                return
            self._logger.info(
                component=AutomationLogComponent.WATCHER,
                event="file_deleted",
                message=f"Detected deleted video file by move: {old_name}",
                meta={"filename": old_name, "path": event.src_path},
            )
            self._schedule(self._storage_service.handle_file_deleted(old_name))
            return

        # Internal move in watched folder.
        if not src_inside or not dest_inside:
            return

        if self._storage_service.is_ignored_name(old_name) or self._storage_service.is_ignored_name(new_name):
            return

        old_is_video = self._storage_service.is_video_file_name(old_name)
        new_is_video = self._storage_service.is_video_file_name(new_name)

        # Renaming video -> non-video behaves like deleting the video.
        if old_is_video and not new_is_video:
            if self._is_duplicate(f"deleted:{old_name}"):
                return
            self._logger.info(
                component=AutomationLogComponent.WATCHER,
                event="file_deleted",
                message=f"Detected deleted video file by rename: {old_name}",
                meta={"filename": old_name, "newName": new_name, "path": event.src_path},
            )
            self._schedule(self._storage_service.handle_file_deleted(old_name))
            return

        # Renaming non-video -> video behaves like creating a video.
        if not old_is_video and new_is_video:
            if self._is_duplicate(f"created:{new_name}"):
                return
            self._logger.info(
                component=AutomationLogComponent.WATCHER,
                event="file_created",
                message=f"Detected new video file by rename: {new_name}",
                meta={"filename": new_name, "oldName": old_name, "path": event.dest_path},
            )
            self._schedule(self._storage_service.handle_file_created(new_name))
            return

        if not old_is_video or not new_is_video:
            return

        if self._is_duplicate(f"renamed:{old_name}:{new_name}"):
            return
        self._logger.info(
            component=AutomationLogComponent.WATCHER,
            event="file_renamed",
            message=f"Detected renamed video file: {old_name} -> {new_name}",
            meta={"oldName": old_name, "newName": new_name, "srcPath": event.src_path, "destPath": event.dest_path},
        )
        self._schedule(self._storage_service.handle_file_renamed(old_name, new_name))


class StorageWatcher:
    def __init__(
        self,
        *,
        storage_path: Path,
        storage_service,
        logger: AutomationSystemLogger,
        debounce_sec: float,
    ) -> None:
        self._default_storage_path = storage_path
        self._storage_service = storage_service
        self._logger = logger
        self._debounce_sec = debounce_sec
        self._observer: Observer | None = None
        self._running = False
        self._enabled = False
        self._watched_path: Path | None = None
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._running:
                return
            self._running = True

    async def update_watch_state(self, *, enabled: bool, watch_path: Path | None) -> None:
        async with self._lock:
            self._enabled = enabled
            self._watched_path = watch_path

        await self._apply_state()

    async def _apply_state(self) -> None:
        async with self._lock:
            if not self._running:
                return

            current_observer = self._observer
            enabled = self._enabled
            watch_path = self._watched_path

        if current_observer is not None:
            await asyncio.to_thread(current_observer.stop)
            await asyncio.to_thread(current_observer.join)
            async with self._lock:
                if self._observer is current_observer:
                    self._observer = None

        if not enabled or watch_path is None:
            return

        exists = await asyncio.to_thread(watch_path.exists)
        if not exists:
            return

        loop = asyncio.get_running_loop()
        handler = _StorageEventHandler(
            loop=loop,
            watch_path=watch_path,
            debounce_sec=self._debounce_sec,
            storage_service=self._storage_service,
            logger=self._logger,
        )
        observer = Observer()
        observer.schedule(handler, str(watch_path), recursive=False)
        await asyncio.to_thread(observer.start)
        async with self._lock:
            if self._running and self._enabled and self._watched_path == watch_path:
                self._observer = observer
                return

        await asyncio.to_thread(observer.stop)
        await asyncio.to_thread(observer.join)

    async def stop(self) -> None:
        async with self._lock:
            if not self._running:
                return
            self._running = False
            observer = self._observer
            self._observer = None

        if observer is not None:
            await asyncio.to_thread(observer.stop)
            await asyncio.to_thread(observer.join)
