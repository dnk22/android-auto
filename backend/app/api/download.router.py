from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.download_schema import DownloadVideoRequest, DownloadVideoResponse


def build_router(download_service) -> APIRouter:
    router = APIRouter(tags=["download"])

    @router.post("/download/video", response_model=DownloadVideoResponse)
    async def download_video(payload: DownloadVideoRequest) -> DownloadVideoResponse:
        try:
            result = await download_service.download_from_url(str(payload.url))
            return DownloadVideoResponse(
                ok=True,
                platform=result.platform,
                fileName=result.file_name,
                filePath=result.file_path,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
