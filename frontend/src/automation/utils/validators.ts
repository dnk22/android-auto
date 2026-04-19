import type { SheetConfig, SheetRow } from "../types/automation.types";

export function validateReadyRow(row: SheetRow, config: SheetConfig): string | null {
  if (!config.hashtagCommon?.trim() && !row.hashtagInline?.trim()) {
    return "Missing hashtag";
  }

  if (!row.products.trim()) {
    return "Missing products";
  }

  if (!row.deviceId.trim()) {
    return "Missing device";
  }

  return null;
}

export function canEditRow(row: SheetRow): boolean {
  return row.status !== "running";
}
