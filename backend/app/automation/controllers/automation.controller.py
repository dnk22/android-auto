from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect

from app.automation.models.sheet_model import SheetRow
from app.automation.schemas.automation_schema import (
    BulkUpdateSheetRequest,
    CreateVideoFolderRequest,
    CreateVideoFolderResponse,
    RenameFileRequest,
    RenameFileResponse,
    SessionResponse,
    SetReadyResponse,
    StorageListResponse,
    UpdateSessionRequest,
    UpdateSheetRowRequest,
)


def build_router(sheet_service, storage_service, queue_service, watcher_service=None) -> APIRouter:
    router = APIRouter(tags=["automation"])

    async def _sync_storage_watcher(_: str) -> None:
        if watcher_service is None:
            return
        watch_path_raw = await storage_service.get_video_folder_path()
        watch_path = Path(watch_path_raw) if watch_path_raw else None
        should_watch = watch_path is not None
        await watcher_service.update_watch_state(enabled=should_watch, watch_path=watch_path)
        if should_watch:
            # Catch up pre-existing files that were already in the folder before watcher was enabled.
            await storage_service.sync_sheet_from_storage()

    @router.websocket("/ws/automation/events")
    async def automation_events_ws(websocket: WebSocket) -> None:
        await websocket.accept()
        queue = await storage_service.subscribe_events()

        try:
            while True:
                event = await queue.get()
                await websocket.send_json(event)
        except WebSocketDisconnect:
            return
        finally:
            await storage_service.unsubscribe_events(queue)

    @router.websocket("/ws/automation/storage")
    async def automation_storage_ws(websocket: WebSocket) -> None:
        await websocket.accept()
        queue = await storage_service.subscribe_events()

        try:
            while True:
                event = await queue.get()
                await websocket.send_json(event)
        except WebSocketDisconnect:
            return
        finally:
            await storage_service.unsubscribe_events(queue)

    @router.get("/automation/sheet", response_model=list[SheetRow])
    async def get_sheet() -> list[SheetRow]:
        state = await sheet_service.list_sheet()
        return state.rows

    @router.patch("/automation/sheet/{videoId}", response_model=SetReadyResponse)
    async def patch_sheet_row(videoId: str, payload: UpdateSheetRowRequest) -> SetReadyResponse:
        try:
            row = await sheet_service.update_row(videoId, payload)
            return SetReadyResponse(ok=True, row=row)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.put("/automation/sheet", response_model=list[SheetRow])
    async def bulk_update_sheet(payload: BulkUpdateSheetRequest) -> list[SheetRow]:
        try:
            await sheet_service.bulk_update_rows(payload.rows)
            state = await sheet_service.list_sheet()
            return state.rows
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    @router.post("/automation/sheet/{videoId}/ready", response_model=SetReadyResponse)
    async def set_sheet_ready(videoId: str) -> SetReadyResponse:
        try:
            row = await sheet_service.set_ready(videoId)
            return SetReadyResponse(ok=True, row=row)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/automation/job/{jobId}/stop")
    async def stop_job(jobId: str):
        try:
            job = await queue_service.stop_job(jobId)
            return {"ok": True, "job": job}
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/automation/session", response_model=SessionResponse)
    async def get_session() -> SessionResponse:
        session = await sheet_service.get_session()
        is_video_folder_created = await storage_service.is_video_folder_created()
        video_folder_path = await storage_service.get_video_folder_path()
        return SessionResponse(
            status=session.status,
            autoReady=session.autoReady,
            isVideoFolderCreated=is_video_folder_created,
            videoFolderPath=video_folder_path,
        )

    @router.patch("/automation/session", response_model=SessionResponse)
    async def patch_session(payload: UpdateSessionRequest) -> SessionResponse:
        try:
            session = await sheet_service.update_session(
                status=payload.status,
                auto_ready=payload.autoReady,
            )
            await _sync_storage_watcher(session.status)
            is_video_folder_created = await storage_service.is_video_folder_created()
            video_folder_path = await storage_service.get_video_folder_path()
            return SessionResponse(
                status=session.status,
                autoReady=session.autoReady,
                isVideoFolderCreated=is_video_folder_created,
                videoFolderPath=video_folder_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/storage/createVideoFolder", response_model=CreateVideoFolderResponse)
    async def create_video_folder(payload: CreateVideoFolderRequest) -> CreateVideoFolderResponse:
        target = await storage_service.create_video_folder(is_desktop=payload.isDesktop)
        session = await sheet_service.get_session()
        await _sync_storage_watcher(session.status)
        is_video_folder_created = await storage_service.is_video_folder_created()
        return CreateVideoFolderResponse(
            ok=True,
            isDesktop=payload.isDesktop,
            path=str(target),
            isVideoFolderCreated=is_video_folder_created,
        )

    @router.get("/automation/storage", response_model=StorageListResponse)
    async def list_storage(request: Request) -> StorageListResponse:
        scheme = "wss" if request.url.scheme == "https" else "ws"
        ws_url = f"{scheme}://{request.url.netloc}/ws/automation/storage"
        rows = await storage_service.list_storage_rows()
        video_folder_path = await storage_service.get_video_folder_path()
        return StorageListResponse(
            wsUrl=ws_url,
            videoFolderPath=video_folder_path,
            rows=rows,
        )

    @router.post("/automation/storage/rename", response_model=RenameFileResponse)
    async def rename_storage_file(payload: RenameFileRequest) -> RenameFileResponse:
        try:
            old_name, new_name, created_by_duplicate = await storage_service.rename_file(
                payload.video_name,
                payload.new_name,
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        return RenameFileResponse(
            ok=True,
            **{"from": old_name, "to": new_name, "createdByDuplicate": created_by_duplicate},
        )

    @router.delete("/automation/storage/{videoName}")
    async def delete_storage_file(videoName: str):
        try:
            await storage_service.delete_file(videoName)
            return {"ok": True}
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    return router
