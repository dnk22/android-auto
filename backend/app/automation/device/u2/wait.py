from __future__ import annotations

import asyncio
import random


async def sleep_jitter(base_sec: float, jitter_sec: float = 0.2) -> None:
    delay = max(0.0, base_sec + random.uniform(-jitter_sec, jitter_sec))
    await asyncio.sleep(delay)
