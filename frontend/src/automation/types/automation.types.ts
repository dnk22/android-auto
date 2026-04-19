export type SheetStatus =
  | "idle"
  | "queued"
  | "ready"
  | "running"
  | "paused"
  | "stopped"
  | "done"
  | "error"
  | "missing_file";

export type SessionStatus = "watching" | "idle";

export type SheetRow = {
  id: string;
  videoId: string;
  videoName: string;
  deviceId: string;
  products: string;
  hashtagInline?: string;
  createdByDuplicate: boolean;
  status: SheetStatus;
  meta?: string | null;
  version: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type SheetResponse = SheetRow[];

export type SessionState = {
  status: SessionStatus;
  autoReady: boolean;
};

export type UpdateRowPayload = {
  products?: string;
  deviceId?: string;
  hashtagInline?: string;
  status?: SheetStatus;
  meta?: string;
  version?: number;
  startedAt?: number | null;
  finishedAt?: number | null;
};

export type UpdateSessionPayload = {
  status?: SessionStatus;
  autoReady?: boolean;
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
