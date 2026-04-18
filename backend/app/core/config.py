from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    host: str
    port: int
    cors_origins: list[str]
    adb_poll_interval_sec: float
    stream_stale_after_sec: float
    disconnect_grace_sec: float
    media_request_timeout_sec: float
    media_nodes: list[str]
    media_ws_base: str



def _as_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default



def _as_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default



def load_settings() -> Settings:
    nodes_raw = os.getenv("MEDIA_NODES", "http://127.0.0.1:9100")
    nodes = [node.strip() for node in nodes_raw.split(",") if node.strip()]
    if not nodes:
        nodes = ["http://127.0.0.1:9100"]

    cors_raw = os.getenv("BACKEND_CORS_ORIGINS", "*")
    cors_origins = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]
    if not cors_origins:
        cors_origins = ["*"]

    return Settings(
        host=os.getenv("BACKEND_HOST", "0.0.0.0"),
        port=_as_int("BACKEND_PORT", 8000),
        cors_origins=cors_origins,
        adb_poll_interval_sec=_as_float("ADB_POLL_INTERVAL_SEC", 1.0),
        stream_stale_after_sec=_as_float("STREAM_STALE_AFTER_SEC", 3.0),
        disconnect_grace_sec=_as_float("DISCONNECT_GRACE_SEC", 30.0),
        media_request_timeout_sec=_as_float("MEDIA_TIMEOUT_SEC", 5.0),
        media_nodes=nodes,
        media_ws_base=os.getenv("MEDIA_WS_BASE", "ws://127.0.0.1:9100"),
    )
