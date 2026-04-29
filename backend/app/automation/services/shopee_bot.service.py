from __future__ import annotations

from app.automation.logging.system_logger import AutomationSystemLogger
from app.automation.scenarios.shopee_upload.payload import ShopeeUploadPayload
from app.automation.scenarios.shopee_upload.runner import ShopeeUploadRunner


class ShopeeBot:
    def __init__(self, *, logger: AutomationSystemLogger, timeout_sec: float) -> None:
        self._runner = ShopeeUploadRunner(
            logger=logger,
            timeout_sec=timeout_sec,
        )

    async def run(
        self,
        device_id: str,
        video_path: str,
        products: list[str],
        hashtag: str,
        auto_log_context=None,
        execution_id: str | None = None,
        job_id: str | None = None,
        video_id: str | None = None,
        video_name: str | None = None,
        device_video_path: str | None = None,
    ) -> None:
        payload = ShopeeUploadPayload(
            execution_id=execution_id or "",
            job_id=job_id or video_id or "",
            video_id=video_id or "",
            device_id=device_id,
            local_video_path=video_path,
            device_video_path=device_video_path or "",
            video_name=video_name or video_path.split("/")[-1],
            products=products,
            hashtag=hashtag,
        )

        await self._runner.run(
            payload=payload,
            auto_log_context=auto_log_context,
        )

    async def stop_device(self, device_id: str) -> None:
        await self._runner.stop_device(device_id)
