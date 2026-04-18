from __future__ import annotations

from collections import Counter

from app.models.device import DeviceState


class MediaScheduler:
    def __init__(self, nodes: list[str]) -> None:
        self._nodes = nodes

    def pick_node(self, device_id: str, previous_node: str | None, devices: list[DeviceState]) -> str:
        if previous_node and previous_node in self._nodes:
            return previous_node

        counts = Counter(device.media_node_id for device in devices if device.media_node_id)
        selected = min(self._nodes, key=lambda node: counts.get(node, 0))
        return selected
