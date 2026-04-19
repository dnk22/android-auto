export type SheetStatus = "idle" | "ready" | "running" | "done" | "error" | "missing_file";

export type SheetRow = {
  videoId: string;
  videoName: string;
  products: string;
  status: SheetStatus;
  createdByDuplicate: boolean;
  deviceId: string;
  hashtagInline?: string;
  meta?: Record<string, any>;
};

export type SheetConfig = {
  hashtagCommon?: string;
  autoReady: boolean;
};

export type SheetResponse = {
  rows: SheetRow[];
  config: SheetConfig;
};

export type UpdateRowPayload = {
  products?: string;
  deviceId?: string;
  hashtagInline?: string;
  meta?: Record<string, any>;
};

export type RenameFilePayload = {
  videoName: string;
  newName?: string;
};

export type StorageListResponse = {
  files: string[];
};

export type DuplicateFileEvent = {
  event: "duplicate_file_detected";
  ts: number;
  payload: {
    originalName: string;
    renamedTo: string;
    createdByDuplicate: boolean;
  };
};

export type AutomationWsEvent = DuplicateFileEvent | { event: string; ts: number; payload: Record<string, unknown> };
