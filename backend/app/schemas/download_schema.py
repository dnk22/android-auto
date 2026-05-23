from __future__ import annotations

from pydantic import BaseModel, HttpUrl


class DownloadVideoRequest(BaseModel):
    url: HttpUrl


class DownloadVideoResponse(BaseModel):
    ok: bool
    platform: str
    fileName: str
    filePath: str
