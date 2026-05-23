from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.download.providers.tiktok_provider import TikTokDownloadError, TikTokProvider


@dataclass(frozen=True)
class DownloadResult:
    platform: str
    file_name: str
    file_path: str


class DownloadService:
    def __init__(self, *, storage_service, tiktok_provider: TikTokProvider | None = None) -> None:
        self._storage_service = storage_service
        self._tiktok_provider = tiktok_provider or TikTokProvider()

    async def download_from_url(self, url: str) -> DownloadResult:
        normalized_url = url.strip()
        if not normalized_url:
            raise ValueError("url is required")

        platform = self._detect_platform(normalized_url)
        if platform == "tiktok":
            return await self._download_tiktok(normalized_url)

        raise ValueError(f"Unsupported platform: {platform}")

    def _detect_platform(self, url: str) -> str:
        host = urlparse(url).netloc.lower()
        if "tiktok.com" in host or "vt.tiktok.com" in host:
            return "tiktok"
        return "unknown"

    async def _download_tiktok(self, url: str) -> DownloadResult:
        try:
            info = await self._tiktok_provider.get_first_format(url)
            video_bytes = await self._tiktok_provider.download(
                video_url=url,
                format_id=info.format_id,
            )
        except TikTokDownloadError as exc:
            raise ValueError(str(exc)) from exc

        if not video_bytes:
            raise ValueError("Downloaded video is empty")

        file_name = self._build_video_name(url, info.title)
        saved_name, saved_path = await self._storage_service.save_downloaded_video(
            preferred_name=file_name,
            content=video_bytes,
        )

        return DownloadResult(
            platform="tiktok",
            file_name=saved_name,
            file_path=str(saved_path),
        )

    def _build_video_name(self, url: str, title: str | None) -> str:
        if title:
            cleaned = re.sub(r"[^a-zA-Z0-9 _-]", "", title).strip()
            cleaned = re.sub(r"\s+", " ", cleaned)
            if cleaned:
                return f"{cleaned}.mp4"

        path = urlparse(url).path
        parts = [part for part in path.split("/") if part]
        fallback = parts[-1] if parts else "video"
        clean_fallback = re.sub(r"[^a-zA-Z0-9_-]", "", fallback) or "video"
        return f"{clean_fallback}.mp4"
