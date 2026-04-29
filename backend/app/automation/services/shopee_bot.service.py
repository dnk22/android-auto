from __future__ import annotations

import asyncio
import time
from typing import Any

from app.automation.logging.system_logger import AutomationLogComponent, AutomationSystemLogger
import uiautomator2 as u2


class ShopeeBot:
    _SHOPEE_PACKAGE = "com.shopee.vn"

    def __init__(self, *, logger: AutomationSystemLogger, timeout_sec: float) -> None:
        self._logger = logger
        self._timeout_sec = timeout_sec
        self._connections: dict[str, Any] = {}

    async def _connect(self, device_id: str) -> Any:
        connection = await asyncio.wait_for(
            asyncio.to_thread(u2.connect, device_id),
            timeout=self._timeout_sec,
        )
        self._connections[device_id] = connection
        return connection

    async def run(
        self,
        device_id: str,
        video_path: str,
        products: list[str],
        hashtag: str,
        auto_log_context=None,
    ) -> None:
        try:
            _ = await self._connect(device_id)
        except Exception as exc:  # noqa: BLE001
            self._logger.error(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_failed",
                message=f"Shopee bot failed to connect to device {device_id}: {exc}",
                deviceId=device_id,
                meta={"error": str(exc)},
            )
            raise RuntimeError("device disconnected") from exc

        self._logger.info(
            component=AutomationLogComponent.SHOPEE_BOT,
            event="bot_started",
            message="Shopee bot started",
            deviceId=device_id,
            meta={"videoPath": video_path, "products": products, "hashtag": hashtag},
        )
        connection = self._connections[device_id]

        try:
            if auto_log_context is not None:
                await auto_log_context.start_step("push_video", "Dang day video vao thiet bi")
                await asyncio.sleep(0.3)
                await auto_log_context.finish_step("push_video", "Day video vao thiet bi thanh cong")

                await auto_log_context.start_step("open_shopee", "Dang mo app Shopee")
            await asyncio.to_thread(connection.app_start, self._SHOPEE_PACKAGE, stop=True)
            await asyncio.sleep(1.5)
            if auto_log_context is not None:
                await auto_log_context.finish_step("open_shopee", "Mo app Shopee thanh cong")

                await auto_log_context.start_step("click_upload", "Dang bam nut dang video")
                await asyncio.sleep(0.3)
                await auto_log_context.finish_step("click_upload", "Bam nut dang video thanh cong")

                await auto_log_context.start_step("select_video", "Dang chon video")
                await asyncio.sleep(0.3)
                await auto_log_context.finish_step("select_video", "Chon video thanh cong")

                await auto_log_context.start_step("input_products", "Dang gan san pham")
                await asyncio.sleep(0.3)
                await auto_log_context.finish_step("input_products", "Gan san pham thanh cong")

                await auto_log_context.start_step("input_hashtag", "Dang nhap hashtag")
                await asyncio.sleep(0.3)
                await auto_log_context.finish_step("input_hashtag", "Nhap hashtag thanh cong")

                await auto_log_context.start_step("submit", "Dang dang video")

            width, height = await asyncio.to_thread(connection.window_size)
            center_x = int(width * 0.5)
            start_y = int(height * 0.78)
            end_y = int(height * 0.28)

            for round_index in range(2):
                # Swipe up
                await asyncio.to_thread(connection.swipe, center_x, start_y, center_x, end_y, 0.2)
                await asyncio.sleep(0.5)

                # Swipe down
                await asyncio.to_thread(connection.swipe, center_x, end_y, center_x, start_y, 0.2)
                await asyncio.sleep(0.5)

            await asyncio.to_thread(connection.press, "home")
            await asyncio.sleep(0.4)
            if auto_log_context is not None:
                await auto_log_context.finish_step("submit", "Dang video thanh cong")
        except Exception as exc:  # noqa: BLE001
            if auto_log_context is not None:
                running_step = await auto_log_context.step_service.get_current_running_step(
                    auto_log_context.execution.id,
                )
                if running_step is not None:
                    await auto_log_context.fail_step(
                        running_step["stepKey"],
                        exc,
                        step_name=running_step["stepName"],
                    )
            self._logger.error(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_failed",
                message=f"Shopee bot failed: {exc}",
                deviceId=device_id,
                meta={"error": str(exc)},
            )
            raise
        finally:
            self._logger.success(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_finished",
                message="Shopee bot finished",
                deviceId=device_id,
            )

    async def stop_device(self, device_id: str) -> None:
        connection = self._connections.get(device_id)
        if connection is None:
            return

        try:
            await asyncio.to_thread(connection.reset_uiautomator)
        except Exception as exc:  # noqa: BLE001
            self._logger.warning(
                component=AutomationLogComponent.SHOPEE_BOT,
                event="bot_stopped",
                message=f"Shopee bot stop failed: {exc}",
                deviceId=device_id,
                meta={"error": str(exc)},
            )
        finally:
            self._connections.pop(device_id, None)
