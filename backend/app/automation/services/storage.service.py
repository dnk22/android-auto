from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Protocol

from app.automation.constants.automation_constants import AutomationSettings


class SheetServiceProtocol(Protocol):
    async def list_sheet(self): ...

    async def get_row_by_video_name(self, video_name: str): ...

    async def upsert_from_storage(self, video_name: str, *, created_by_duplicate: bool): ...

    async def mark_file_removed(self, video_name: str): ...

    async def rename_video(self, old_name: str, new_name: str): ...

    async def has_video_name(self, video_name: str) -> bool: ...

    async def assert_can_delete(self, video_name: str) -> None: ...

    async def assert_video_idle(self, video_name: str) -> None: ...

    async def rename_video_for_external_event(self, old_name: str, new_name: str): ...


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

    @staticmethod
    def is_video_file_name(file_name: str) -> bool:
        suffix = Path(file_name).suffix.lower()
        return suffix in {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}

    def _repo_video_folder(self) -> Path:
        backend_root = Path(__file__).resolve().parents[3]
        return backend_root / "storage" / "video"

    def _system_path_json(self) -> Path:
        repo_root = Path(__file__).resolve().parents[4]
        return repo_root / "storage" / "systemPath.json"

    def _desktop_video_folder(self) -> Path:
        return Path.home() / "Desktop" / "video"

    def _read_saved_video_folder_path(self) -> str | None:
        system_path_file = self._system_path_json()
        if not system_path_file.exists():
            return None
        try:
            raw = json.loads(system_path_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        candidate = raw.get("videoFolderPath") if isinstance(raw, dict) else None
        if not isinstance(candidate, str) or not candidate.strip():
            return None
        return candidate.strip()

    async def get_active_video_folder_path(self) -> Path:
        saved = await asyncio.to_thread(self._read_saved_video_folder_path)
        if saved:
            return Path(saved)
        return self._repo_video_folder()

    async def is_video_folder_created(self) -> bool:
        active_path = await self.get_active_video_folder_path()
        return bool(await asyncio.to_thread(active_path.exists))

    async def get_video_folder_path(self) -> str | None:
        saved_path = await asyncio.to_thread(self._read_saved_video_folder_path)
        if saved_path is not None:
            return saved_path

        repo_video = self._repo_video_folder()
        desktop_video = self._desktop_video_folder()
        repo_exists, desktop_exists = await asyncio.gather(
            asyncio.to_thread(repo_video.exists),
            asyncio.to_thread(desktop_video.exists),
        )
        if repo_exists:
            return str(repo_video)
        if desktop_exists:
            return str(desktop_video)
        return None

    async def create_video_folder(self, *, is_desktop: bool) -> Path:
        target = self._desktop_video_folder() if is_desktop else self._repo_video_folder()
        await asyncio.to_thread(target.mkdir, parents=True, exist_ok=True)
        await self._persist_video_folder_path(target=target, is_desktop=is_desktop)
        self._log(
            "info",
            "video_folder_created",
            path=str(target),
            isDesktop=is_desktop,
        )
        return target

    async def list_storage_rows(self):
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")
        path = await self.get_active_video_folder_path()
        if not await asyncio.to_thread(path.exists):
            return []

        def _collect_names() -> set[str]:
            return {
                item.name
                for item in path.iterdir()
                if item.is_file()
                and not self.is_ignored_name(item.name)
                and self.is_video_file_name(item.name)
            }

        names = await asyncio.to_thread(_collect_names)
        rows = await self._sheet_service.list_sheet()
        return [row for row in rows.rows if row.videoName in names]

    async def _persist_video_folder_path(self, *, target: Path, is_desktop: bool) -> None:
        system_path_file = self._system_path_json()

        def _write() -> None:
            system_path_file.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "videoFolderPath": str(target),
                "isDesktop": is_desktop,
                "updatedAt": int(time.time()),
            }
            system_path_file.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")

        await asyncio.to_thread(_write)

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
        target_dir = await self.get_active_video_folder_path()
        await asyncio.to_thread(target_dir.mkdir, parents=True, exist_ok=True)

        def _collect() -> list[str]:
            files = [
                item.name
                for item in target_dir.iterdir()
                if item.is_file()
                and not self.is_ignored_name(item.name)
                and self.is_video_file_name(item.name)
            ]
            return sorted(files)

        return await asyncio.to_thread(_collect)

    async def has_file(self, video_name: str) -> bool:
        if self.is_ignored_name(video_name):
            return False
        target_dir = await self.get_active_video_folder_path()
        target = target_dir / video_name
        return await asyncio.to_thread(target.exists)

    async def resolve_video_path(self, video_name: str) -> Path | None:
        if self.is_ignored_name(video_name):
            return None
        target_dir = await self.get_active_video_folder_path()
        target = target_dir / video_name
        exists = await asyncio.to_thread(target.exists)
        return target if exists else None

    async def sync_sheet_from_storage(self) -> None:
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")

        for file_name in await self.list_files():
            row = await self._sheet_service.upsert_from_storage(
                file_name,
                created_by_duplicate=False,
            )
            await self._emit_event(
                "storage_row_upserted",
                {
                    "row": row.model_dump(),
                },
            )

    async def handle_file_created(self, video_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(video_name):
            return
        if not self.is_video_file_name(video_name):
            return

        target_dir = await self.get_active_video_folder_path()

        async with self._lock:
            created_by_duplicate = False
            final_name = video_name

            existing_row = await self._sheet_service.get_row_by_video_name(video_name)
            should_duplicate = existing_row is not None and existing_row.status != "missing_file"

            if should_duplicate:
                generated = f"video_{int(time.time())}.mp4"
                src = target_dir / video_name
                dst = target_dir / generated
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

            row = await self._sheet_service.upsert_from_storage(
                final_name,
                created_by_duplicate=created_by_duplicate,
            )
            await self._emit_event(
                "storage_row_upserted",
                {
                    "row": row.model_dump(),
                },
            )

    async def handle_file_deleted(self, video_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(video_name):
            return
        if not self.is_video_file_name(video_name):
            return
        row = await self._sheet_service.mark_file_removed(video_name)
        await self._emit_event(
            "storage_row_deleted",
            {
                "videoName": video_name,
                "row": row.model_dump() if row is not None else None,
            },
        )

    async def handle_file_renamed(self, old_name: str, new_name: str) -> None:
        if self._sheet_service is None:
            return
        if self.is_ignored_name(old_name) or self.is_ignored_name(new_name):
            return
        if not self.is_video_file_name(new_name):
            return
        row = await self._sheet_service.rename_video_for_external_event(old_name, new_name)
        await self._emit_event(
            "storage_row_renamed",
            {
                "oldName": old_name,
                "newName": new_name,
                "row": row.model_dump() if row is not None else None,
            },
        )

    async def rename_file(self, video_name: str, new_name: str | None) -> tuple[str, str, bool]:
        if self._sheet_service is None:
            raise RuntimeError("sheet service is not bound")

        await self._sheet_service.assert_video_idle(video_name)
        target_dir = await self.get_active_video_folder_path()

        async with self._lock:
            src = target_dir / video_name
            if not await asyncio.to_thread(src.exists):
                raise FileNotFoundError("file not found")

            candidate = (new_name or "").strip()
            if not candidate:
                suffix = src.suffix or ".mp4"
                candidate = f"video_{int(time.time())}{suffix}"

            if not self.is_video_file_name(candidate):
                raise ValueError("only video files are allowed")

            dst = target_dir / candidate
            created_by_duplicate = False
            if await asyncio.to_thread(dst.exists):
                suffix = dst.suffix or ".mp4"
                candidate = f"video_{int(time.time())}{suffix}"
                dst = target_dir / candidate
                created_by_duplicate = True

            await asyncio.to_thread(src.rename, dst)
            row = await self._sheet_service.rename_video(video_name, candidate)

            await self._emit_event(
                "storage_row_renamed",
                {
                    "oldName": video_name,
                    "newName": candidate,
                    "row": row.model_dump() if row is not None else None,
                },
            )

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

        await self._sheet_service.assert_video_idle(video_name)

        target_dir = await self.get_active_video_folder_path()
        target = target_dir / video_name
        if not await asyncio.to_thread(target.exists):
            raise FileNotFoundError("file not found")

        await asyncio.to_thread(target.unlink)
        row = await self._sheet_service.mark_file_removed(video_name)
        await self._emit_event(
            "storage_row_deleted",
            {
                "videoName": video_name,
                "row": row.model_dump() if row is not None else None,
            },
        )
        self._log("info", "storage_deleted", videoName=video_name)
