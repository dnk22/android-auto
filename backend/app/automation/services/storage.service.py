from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Protocol

from app.automation.constants.automation_constants import AutomationSettings


class SheetServiceProtocol(Protocol):
    async def upsert_from_storage(self, video_name: str, *, created_by_duplicate: bool): ...

    async def mark_file_removed(self, video_name: str): ...

    async def rename_video(self, old_name: str, new_name: str): ...

    async def has_video_name(self, video_name: str) -> bool: ...

    async def assert_can_delete(self, video_name: str) -> None: ...


class StorageService:
    def __init__(self, *, settings: AutomationSettings, logger: logging.Logger) -> None:
        self._settings = settings
        self._storage_path = settings.storage_dir
        self._logger = logger
        self._sheet_service: SheetServiceProtocol | None = None
        self._lock = asyncio.Lock()
        self._event_lock = asyncio.Lock()
        self._event_subscribers: set[asyncio.Queue[dict[str, object]]] = set()

    @property
    def storage_path(self) -> Path:
        return self._storage_path

    def _repo_video_folder(self) -> Path:
        backend_root = Path(__file__).resolve().parents[3]
        return backend_root / "storage" / "video"

    def _desktop_video_folder(self) -> Path:
        return Path.home() / "Desktop" / "video"

    async def is_video_folder_created(self) -> bool:
        repo_video = self._repo_video_folder()
        desktop_video = self._desktop_video_folder()

        repo_exists, desktop_exists = await asyncio.gather(
            asyncio.to_thread(repo_video.exists),
            asyncio.to_thread(desktop_video.exists),
        )
        return bool(repo_exists or desktop_exists)

    async def create_video_folder(self, *, is_desktop: bool) -> Path:
        target = self._desktop_video_folder() if is_desktop else self._repo_video_folder()
        await asyncio.to_thread(target.mkdir, parents=True, exist_ok=True)
        self._log(
            "info",
            "video_folder_created",
            path=str(target),
            isDesktop=is_desktop,
        )
        return target

    def is_ignored_name(self, file_name: str) -> bool:
        name = file_name.strip()
        lower = name.lower()
        if not name:
            return True
        if lower == "automation.db":
            return True
        if lower.startswith("automation.db-"):
            return True
        if lower.endswith(".db-journal") or lower.endswith(".db-wal") or lower.endswith(".db-shm"):
            return True
        return False

    def _log(self, level: str, event: str, **meta: object) -> None:
        payload = {
            "ts": int(time.time()),
            "service": "automation",
            "component": "storage",
            "event": event,
            "meta": meta,
        }
        getattr(self._logger, level)(json.dumps(payload, ensure_ascii=True))

    def bind_sheet_service(self, sheet_service: SheetServiceProtocol) -> None:
        self._sheet_service = sheet_service

    async def subscribe_events(self) -> asyncio.Queue[dict[str, object]]:
        queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
        async with self._event_lock:
            self._event_subscribers.add(queue)
        return queue

    async def unsubscribe_events(self, queue: asyncio.Queue[dict[str, object]]) -> None:
        async with self._event_lock:
            self._event_subscribers.discard(queue)

    async def _emit_event(self, event: str, payload: dict[str, object]) -> None:
        data: dict[str, object] = {
            "event": event,
            "payload": payload,
            "ts": int(time.time()),
        }
        async with self._event_lock:
            subscribers = list(self._event_subscribers)

        for subscriber in subscribers:
            subscriber.put_nowait(data)

    async def ensure_storage_dir(self) -> None:
        await asyncio.to_thread(self._storage_path.mkdir, parents=True, exist_ok=True)

    async def list_files(self) -> list[str]:
        await self.ensure_storage_dir()

        def _collect() -> list[str]:
            files = [
                item.name
                for item in self._storage_path.iterdir()
                if item.is_file() and not self.is_ignored_name(item.name)
            ]
            return sorted(files)

        return await asyncio.to_thread(_collect)

    async def has_file(self, video_name: str) -> bool:
        if self.is_ignored_name(video_name):
            return False
        target = self._storage_path / video_name
        return await asyncio.to_thread(target.exists)

    async def resolve_video_path(self, video_name: str) -> Path | None:
        if self.is_ignored_name(video_name):
            return None
        target = self._storage_path / video_name
        exists = await asyncio.to_thread(target.exists)
        return target if exists else None

    async def sync_sheet_from_storage(self) -> None:
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")

        for file_name in await self.list_files():
            await self._sheet_service.upsert_from_storage(file_name, created_by_duplicate=False)

    async def handle_file_created(self, video_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(video_name):
            return

        async with self._lock:
            created_by_duplicate = False
            final_name = video_name

            exists_in_sheet = await self._sheet_service.has_video_name(video_name)
            if exists_in_sheet:
                generated = f"video_{int(time.time())}.mp4"
                src = self._storage_path / video_name
                dst = self._storage_path / generated
                if not await asyncio.to_thread(src.exists):
                    self._log("info", "transient_file_skipped", name=video_name)
                    return
                try:
                    await asyncio.to_thread(src.rename, dst)
                except FileNotFoundError:
                    self._log("info", "transient_file_skipped", name=video_name)
                    return
                final_name = generated
                created_by_duplicate = True
                await self._emit_event(
                    "duplicate_file_detected",
                    {
                        "originalName": video_name,
                        "renamedTo": final_name,
                        "createdByDuplicate": True,
                    },
                )
                self._log(
                    "warning",
                    "duplicate_file_detected",
                    originalName=video_name,
                    renamedTo=final_name,
                )

            await self._sheet_service.upsert_from_storage(
                final_name,
                created_by_duplicate=created_by_duplicate,
            )

    async def handle_file_deleted(self, video_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(video_name):
            return
        await self._sheet_service.mark_file_removed(video_name)

    async def handle_file_renamed(self, old_name: str, new_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(old_name) or self.is_ignored_name(new_name):
            return
        await self._sheet_service.rename_video(old_name, new_name)

    async def rename_file(self, video_name: str, new_name: str | None) -> tuple[str, str, bool]:
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")

        async with self._lock:
            src = self._storage_path / video_name
            if not await asyncio.to_thread(src.exists):
                raise FileNotFoundError("file not found")

            candidate = (new_name or "").strip()
            if not candidate:
                suffix = src.suffix or ".mp4"
                candidate = f"video_{int(time.time())}{suffix}"

            dst = self._storage_path / candidate
            created_by_duplicate = False
            if await asyncio.to_thread(dst.exists):
                suffix = dst.suffix or ".mp4"
                candidate = f"video_{int(time.time())}{suffix}"
                dst = self._storage_path / candidate
                created_by_duplicate = True

            await asyncio.to_thread(src.rename, dst)
            await self._sheet_service.rename_video(video_name, candidate)

            self._log(
                "info",
                "storage_renamed",
                fromName=video_name,
                toName=candidate,
                createdByDuplicate=created_by_duplicate,
            )
            return video_name, candidate, created_by_duplicate

    async def delete_file(self, video_name: str) -> None:
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")

        await self._sheet_service.assert_can_delete(video_name)

        target = self._storage_path / video_name
        if not await asyncio.to_thread(target.exists):
            raise FileNotFoundError("file not found")

        await asyncio.to_thread(target.unlink)
        await self._sheet_service.mark_file_removed(video_name)
        self._log("info", "storage_deleted", videoName=video_name)
