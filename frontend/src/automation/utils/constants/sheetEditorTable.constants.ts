import type { SheetStatus } from "../../types/automation.types";

export const SHEET_EDITOR_STATUS_OPTIONS: SheetStatus[] = [
  "idle",
  "queued",
  "ready",
  "running",
  "paused",
  "stopped",
  "done",
  "error",
  "missing_file",
];

export const SHEET_EDITOR_COLUMN_LABELS = {
  videoName: "Video Name",
  deviceId: "Device",
  products: "Sản phẩm",
  hashtagInline: "Hashtag",
  status: "Trang thái",
  details: "Chi tiết",
  action: "Action",
} as const;
