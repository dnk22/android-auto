from __future__ import annotations


class UiActionError(Exception):
    """Base error for UI automation actions."""


class UiElementNotFoundError(UiActionError):
    """Raised when an expected UI element cannot be found."""


class UiInputError(UiActionError):
    """Raised when text input fails."""


class UiScrollError(UiActionError):
    """Raised when scroll action fails."""
