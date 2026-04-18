from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar


T = TypeVar("T")



def with_retry(
    retries: int = 2,
    delay_sec: float = 0.2,
    retry_for: tuple[type[BaseException], ...] = (Exception,),
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        async def wrapped(*args, **kwargs) -> T:
            attempt = 0
            while True:
                try:
                    return await func(*args, **kwargs)
                except retry_for:
                    attempt += 1
                    if attempt > retries:
                        raise
                    await asyncio.sleep(delay_sec)

        return wrapped

    return decorator
