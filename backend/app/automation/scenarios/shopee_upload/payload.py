from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .constants import SHOPEE_UPLOAD_SCENARIO_NAME


@dataclass
class ShopeeUploadPayload:
    execution_id: str
    job_id: str
    video_id: str

    device_id: str

    local_video_path: str
    device_video_path: str
    video_name: str

    products: list[str]
    hashtag: str

    scenario_name: str = SHOPEE_UPLOAD_SCENARIO_NAME

    connection: Any | None = None
    extra: dict[str, Any] = field(default_factory=dict)
