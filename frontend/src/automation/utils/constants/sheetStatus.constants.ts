import type { SheetStatus } from "../../types/sheetStatus.types";

export const SHEET_STATUS_LABELS_VI: Record<SheetStatus, string> = {
  idle: "Chờ xử lý",
  queued: "Đang xếp hàng",
  ready: "Sẵn sàng",
  running: "Đang chạy",
  paused: "Tạm dừng",
  stopped: "Đã dừng",
  done: "Hoàn thành",
  error: "Lỗi",
  missing_file: "Thiếu file",
};

export function getSheetStatusLabelVi(status: SheetStatus): string {
  return SHEET_STATUS_LABELS_VI[status];
}
