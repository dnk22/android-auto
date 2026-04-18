from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models.api import StreamResponse



def build_router(device_manager, media_client):
    router = APIRouter(tags=["stream"])

    @router.get("/devices/{device_id}/stream", response_model=StreamResponse)
    async def get_stream(device_id: str) -> StreamResponse:
        try:
            state = await device_manager.ensure_stream(device_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if not state.media_node_id:
            raise HTTPException(status_code=500, detail="No media node assigned")

        return StreamResponse(
            wsUrl=media_client.stream_ws_url(device_id, state.media_node_id),
            status=state.stream,
        )

    return router
