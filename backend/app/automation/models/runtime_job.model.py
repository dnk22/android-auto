from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class RuntimeJob:
    execution_id: str
    job_id: str
    video_id: str
    assigned_device: str
