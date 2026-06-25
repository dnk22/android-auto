from __future__ import annotations

import asyncio
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from starlette.datastructures import UploadFile

from app.schemas.caption_analyze_schema import CaptionAnalyzeResult
from app.services.caption import CaptionAnalyzeService

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}


def build_router(caption_service: CaptionAnalyzeService) -> APIRouter:
    router = APIRouter(tags=["video-caption"])

    @router.post("/api/videos/analyze-caption", response_model=CaptionAnalyzeResult)
    async def analyze_caption(request: Request) -> CaptionAnalyzeResult:
        try:
            form = await request.form()
        except AssertionError as exc:
            raise HTTPException(status_code=500, detail="python-multipart is required") from exc
        file = form.get("file")
        if not isinstance(file, UploadFile):
            raise HTTPException(status_code=400, detail="multipart field 'file' is required")

        filename = Path(file.filename or "uploaded-video").name
        content_type = (file.content_type or "").lower()
        suffix = Path(filename).suffix.lower()
        if not _is_video_upload(content_type, suffix):
            raise HTTPException(status_code=400, detail="file must be a supported video")

        with tempfile.TemporaryDirectory(prefix="caption-upload-") as temp_dir:
            target_path = Path(temp_dir) / filename
            size_bytes = await _save_upload(file, target_path)
            if size_bytes <= 0:
                raise HTTPException(status_code=400, detail="uploaded file is empty")

            return await asyncio.to_thread(
                caption_service.analyze,
                str(target_path),
                filename,
                size_bytes,
            )

    return router


def _is_video_upload(content_type: str, suffix: str) -> bool:
    return content_type.startswith("video/") or suffix in VIDEO_EXTENSIONS


async def _save_upload(file: UploadFile, target_path: Path) -> int:
    def _copy() -> int:
        file.file.seek(0)
        with target_path.open("wb") as output:
            shutil.copyfileobj(file.file, output)
        return target_path.stat().st_size

    try:
        return await asyncio.to_thread(_copy)
    finally:
        await file.close()
