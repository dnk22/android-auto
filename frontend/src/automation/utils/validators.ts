import type { SheetRow } from "../types/automation.types";

export function validateReadyRow(row: SheetRow): string | null {
  if (!row.hashtagInline?.trim()) {
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
