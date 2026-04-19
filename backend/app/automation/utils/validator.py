from __future__ import annotations

from app.automation.models.sheet_model import SheetConfig, SheetRow


def parse_products(raw_products: str) -> list[str]:
    chunks = [item.strip() for item in raw_products.replace("\n", ",").split(",")]
    return [item for item in chunks if item]


def build_hashtag(row: SheetRow, config: SheetConfig) -> str | None:
    if config.hashtagCommon and config.hashtagCommon.strip():
        return config.hashtagCommon.strip()
    if row.hashtagInline and row.hashtagInline.strip():
        return row.hashtagInline.strip()
    return None


def validate_row(row: SheetRow, config: SheetConfig, file_exists: bool) -> tuple[bool, str | None]:
    if not file_exists:
        return False, "missing file"

    if not row.deviceId.strip():
        return False, "deviceId is required"

    if not parse_products(row.products):
        return False, "products is required"

    if build_hashtag(row, config) is None:
        return False, "hashtagInline is required when hashtagCommon is empty"

    return True, None
