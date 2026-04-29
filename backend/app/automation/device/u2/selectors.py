from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class UiSelector:
    resource_id: str | None = None
    text: str | None = None
    text_contains: str | None = None
    description: str | None = None
    description_contains: str | None = None
    class_name: str | None = None
    xpath: str | None = None
    index: int | None = None

    def to_meta(self) -> dict[str, Any]:
        return {
            "resourceId": self.resource_id,
            "text": self.text,
            "textContains": self.text_contains,
            "description": self.description,
            "descriptionContains": self.description_contains,
            "className": self.class_name,
            "xpath": self.xpath,
            "index": self.index,
        }


@dataclass
class UiActionContext:
    device_id: str
    step_key: str | None = None
    auto_log_context: Any | None = None
