from __future__ import annotations

import asyncio


async def wait_seconds(seconds: float) -> None:
    await asyncio.sleep(seconds)
