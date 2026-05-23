from __future__ import annotations

from dataclasses import dataclass

import httpx


class TikTokDownloadError(Exception):
    pass


@dataclass(frozen=True)
class TikTokVideoInfo:
    format_id: str
    title: str | None = None


class TikTokProvider:
    def __init__(self, *, timeout_sec: float = 30.0) -> None:
        self._timeout_sec = timeout_sec
        self._info_url = "https://api.snap-video.com/api/get-info"
        self._download_url = "https://api.snap-video.com/api/download"

    async def get_first_format(self, video_url: str) -> TikTokVideoInfo:
        payload = {"url": video_url}
        timeout = httpx.Timeout(self._timeout_sec)

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(self._info_url, json=payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise TikTokDownloadError(f"Cannot fetch TikTok video info: {exc}") from exc

        data = response.json()
        videos = data.get("videos") if isinstance(data, dict) else None
        if not isinstance(videos, list):
            raise TikTokDownloadError("Invalid response from info API: missing videos")

        if len(videos) == 0:
            raise TikTokDownloadError("No video format available for this video")
        first_item = videos[0]
        if not isinstance(first_item, dict):
            raise TikTokDownloadError("Invalid response from info API: videos[0] is invalid")
        format_id = first_item.get("format_id")
        if not isinstance(format_id, str) or not format_id.strip():
            raise TikTokDownloadError("Invalid response from info API: format_id is missing")
        title = self._extract_title(data)
        return TikTokVideoInfo(format_id=format_id.strip(), title=title)

    def _extract_title(self, payload: dict) -> str | None:
        title_keys = ("title", "video_title", "name", "description", "desc")
        for key in title_keys:
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return None

    async def download(self, *, video_url: str, format_id: str) -> bytes:
        payload = {
            "url": video_url,
            "format_id": format_id,
        }
        timeout = httpx.Timeout(self._timeout_sec)

        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                response = await client.post(self._download_url, json=payload)
                response.raise_for_status()
            except httpx.HTTPError as exc:
                raise TikTokDownloadError(f"Cannot download TikTok video: {exc}") from exc

        return response.content
