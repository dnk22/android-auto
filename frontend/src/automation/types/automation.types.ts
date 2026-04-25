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
  hashtagCommon?: string | null;
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
  hashtagCommon?: string | null;
  isVideoFolderCreated: boolean;
  videoFolderPath?: string | null;
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
  hashtagCommon?: string | null;
};

export type CreateVideoFolderPayload = {
  isDesktop: boolean;
};

export type CreateVideoFolderResponse = {
  ok: boolean;
  isDesktop: boolean;
  path: string;
  isVideoFolderCreated: boolean;
};

export type RenameFilePayload = {
  videoName: string;
  newName?: string;
};

export type StorageListResponse = {
  wsUrl: string;
  videoFolderPath?: string | null;
  rows: SheetRow[];
};

export type OpenVideoFolderResponse = {
  ok: boolean;
  path: string;
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

export type StorageRowUpsertedEvent = {
  event: "storage_row_upserted";
  ts: number;
  payload: {
    row: SheetRow;
  };
};

export type StorageRowRenamedEvent = {
  event: "storage_row_renamed";
  ts: number;
  payload: {
    oldName: string;
    newName: string;
    row?: SheetRow | null;
  };
};

export type StorageRowDeletedEvent = {
  event: "storage_row_deleted";
  ts: number;
  payload: {
    videoName: string;
    row?: SheetRow | null;
  };
};

export type StorageWsEvent =
  | DuplicateFileEvent
  | StorageRowUpsertedEvent
  | StorageRowRenamedEvent
  | StorageRowDeletedEvent
  | { event: string; ts: number; payload: Record<string, unknown> };
