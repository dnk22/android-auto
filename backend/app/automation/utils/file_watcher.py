from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path

from watchdog.events import FileSystemEvent, FileSystemEventHandler, FileSystemMovedEvent
from watchdog.observers import Observer


class _StorageEventHandler(FileSystemEventHandler):
    def __init__(
        self,
        *,
        loop: asyncio.AbstractEventLoop,
        debounce_sec: float,
        storage_service,
        logger: logging.Logger,
    ) -> None:
        self._loop = loop
        self._debounce_sec = debounce_sec
        self._storage_service = storage_service
        self._logger = logger

    def _log(self, level: str, event: str, **meta: object) -> None:
        payload = {
            "ts": int(time.time()),
            "service": "automation",
            "component": "watcher",
            "event": event,
            "meta": meta,
        }
        getattr(self._logger, level)(json.dumps(payload, ensure_ascii=True))

    def _schedule(self, coro) -> None:
        async def _wrapped() -> None:
            await asyncio.sleep(self._debounce_sec)
            await coro

        self._loop.call_soon_threadsafe(lambda: self._loop.create_task(_wrapped()))

    def on_created(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        name = Path(event.src_path).name
        self._log("info", "file_created", name=name)
        self._schedule(self._storage_service.handle_file_created(name))

    def on_deleted(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return
        name = Path(event.src_path).name
        self._log("info", "file_deleted", name=name)
        self._schedule(self._storage_service.handle_file_deleted(name))

    def on_moved(self, event: FileSystemMovedEvent) -> None:
        if event.is_directory:
            return
        old_name = Path(event.src_path).name
        new_name = Path(event.dest_path).name
        self._log("info", "file_renamed", oldName=old_name, newName=new_name)
        self._schedule(self._storage_service.handle_file_renamed(old_name, new_name))


class StorageWatcher:
    def __init__(
        self,
        *,
        storage_path: Path,
        storage_service,
        logger: logging.Logger,
        debounce_sec: float,
    ) -> None:
        self._storage_path = storage_path
        self._storage_service = storage_service
        self._logger = logger
        self._debounce_sec = debounce_sec
        self._observer = Observer()
        self._running = False

    async def start(self) -> None:
        if self._running:
            return

        loop = asyncio.get_running_loop()
        handler = _StorageEventHandler(
            loop=loop,
            debounce_sec=self._debounce_sec,
            storage_service=self._storage_service,
            logger=self._logger,
        )
        self._observer.schedule(handler, str(self._storage_path), recursive=False)
        await asyncio.to_thread(self._observer.start)
        self._running = True

    async def stop(self) -> None:
        if not self._running:
            return

        await asyncio.to_thread(self._observer.stop)
        await asyncio.to_thread(self._observer.join)
        self._running = False
