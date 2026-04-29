from __future__ import annotations


class ShopeeUploadError(Exception):
    """Base exception for Shopee upload scenario."""


class StepFailedException(ShopeeUploadError):
    def __init__(
        self,
        message: str,
        *,
        step_key: str,
        reason: str = "step_failed",
        meta: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.step_key = step_key
        self.reason = reason
        self.meta = meta or {}


class PauseRequiredException(ShopeeUploadError):
    def __init__(
        self,
        message: str,
        *,
        step_key: str,
        reason: str = "manual_intervention_required",
        meta: dict | None = None,
    ) -> None:
        super().__init__(message)
        self.step_key = step_key
        self.reason = reason
        self.meta = meta or {}
