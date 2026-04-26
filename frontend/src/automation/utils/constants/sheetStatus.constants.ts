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

export const SHEET_STATUS_TONE_CLASSES: Record<SheetStatus, string> = {
  idle:
    "!border-slate-400 !bg-slate-100 !text-slate-800",
  queued:
    "!border-amber-400 !bg-amber-100 !text-amber-900",
  ready:
    "!border-emerald-400 !bg-emerald-100 !text-emerald-900",
  running:
    "!border-cyan-400 !bg-cyan-100 !text-cyan-900",
  paused:
    "!border-orange-400 !bg-orange-100 !text-orange-900",
  stopped:
    "!border-slate-400 !bg-slate-100 !text-slate-800",
  done:
    "!border-blue-400 !bg-blue-100 !text-blue-900",
  error:
    "!border-rose-400 !bg-rose-100 !text-rose-900",
  missing_file:
    "!border-red-400 !bg-red-100 !text-red-900",
};

export function getSheetStatusLabelVi(status: SheetStatus): string {
  return SHEET_STATUS_LABELS_VI[status];
}

export function getSheetStatusToneClasses(status: SheetStatus): string {
  return SHEET_STATUS_TONE_CLASSES[status];
}
