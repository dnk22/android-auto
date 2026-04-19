from __future__ import annotations

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.automation.models.sheet_model import SessionState, SheetRow
from app.automation.schemas.automation_schema import (
    BulkUpdateSheetRequest,
    RenameFileRequest,
    RenameFileResponse,
    SetReadyResponse,
    StorageListResponse,
    UpdateSessionRequest,
    UpdateSheetRowRequest,
)


def build_router(sheet_service, storage_service, queue_service) -> APIRouter:
    router = APIRouter(tags=["automation"])

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

    @router.get("/automation/session", response_model=SessionState)
    async def get_session() -> SessionState:
        session = await sheet_service.get_session()
        return session

    @router.patch("/automation/session", response_model=SessionState)
    async def patch_session(payload: UpdateSessionRequest) -> SessionState:
        try:
            session = await sheet_service.update_session(
                status=payload.status,
                auto_ready=payload.autoReady,
            )
            return session
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/automation/storage", response_model=StorageListResponse)
    async def list_storage() -> StorageListResponse:
        files = await storage_service.list_files()
        return StorageListResponse(files=files)

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
