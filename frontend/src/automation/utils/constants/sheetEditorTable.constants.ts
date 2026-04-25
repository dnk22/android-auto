import type { SheetStatus } from "../../types/sheetStatus.types";
import { SHEET_STATUS_VALUES } from "../../types/sheetStatus.types";

export const SHEET_EDITOR_STATUS_OPTIONS: SheetStatus[] = [...SHEET_STATUS_VALUES];

export const SHEET_EDITOR_COLUMN_LABELS = {
  videoName: "Video Name",
  deviceId: "Device",
  products: "Sản phẩm",
  hashtagInline: "Hashtag",
  status: "Trang thái",
  details: "Chi tiết",
  action: "Action",
} as const;
