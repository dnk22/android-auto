export const SHEET_STATUS_VALUES = [
  "idle",
  "queued",
  "ready",
  "running",
  "paused",
  "stopped",
  "done",
  "error",
  "missing_file",
] as const;

export type SheetStatus = (typeof SHEET_STATUS_VALUES)[number];
