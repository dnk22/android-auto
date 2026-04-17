import asyncio

from app.core.device_manager import device_manager
from app.core.logger import log_hub


class ShopeeBot:
    def __init__(self, device_id: str | None = None) -> None:
        self.device_id = device_id

    async def run(self) -> None:
        await log_hub.log(
            f"Starting ShopeeBot on device: {self.device_id or 'default'}"
        )

        if self.device_id:
            try:
                device = device_manager.get_device(self.device_id)
                _ = device.info
                await log_hub.log(f"Device ready: {self.device_id}")
            except Exception as exc:
                await log_hub.log(
                    f"Cannot access device {self.device_id}: {exc}"
                )
                return

        steps = [
            "Open Shopee app",
            "Search for item",
            "Open product page",
            "Add to cart",
            "Checkout",
            "Confirm order",
        ]
        for step in steps:
            if self.device_id:
                try:
                    device = device_manager.get_device(self.device_id)
                    _ = device.info
                except Exception as exc:
                    await log_hub.log(
                        f"Device lost during step '{step}': {exc}"
                    )
                    return
            await asyncio.sleep(1)
            await log_hub.log(f"ShopeeBot step: {step}")
        await log_hub.log("ShopeeBot completed")
