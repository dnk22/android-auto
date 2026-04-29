from __future__ import annotations

from typing import Any


async def paste_text(connection: Any, text: str, *, auto_log_context=None) -> None:
    """Placeholder for clipboard paste."""
    _ = (connection, text, auto_log_context)
    return None


async def input_text_with_fallback(
    connection: Any,
    text: str,
    *,
    field_name: str,
    auto_log_context=None,
) -> None:
    """
    Placeholder for input strategy:
    1. clipboard paste
    2. set_text fallback
    3. adb input fallback
    """
    _ = (connection, text, field_name, auto_log_context)
    return None
