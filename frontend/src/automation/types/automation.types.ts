import type { SheetStatus } from "./sheetStatus.types";

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

export type DownloadVideoResponse = {
  ok: boolean;
  platform: string;
  fileName: string;
  filePath: string;
};

export type CaptionType =
  | "soft_subtitle"
  | "hardcoded_visual_caption"
  | "speech_caption_possible"
  | "no_caption_detected"
  | "unknown";

export type CaptionAnalyzeResult = {
  file: {
    filename: string;
    size_bytes: number;
    duration_seconds?: number | null;
    format_name?: string | null;
  };
  caption_type: CaptionType;
  confidence: number;
  summary: string;
  has_soft_subtitle: boolean;
  has_hardcoded_visual_text: boolean;
  has_audio: boolean;
  has_speech_likely?: boolean | null;
  recommendation: {
    next_step: string;
    reason: string;
  };
  errors: string[];
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

export type SheetRowUpdatedEvent = {
  event: "sheet_row_updated";
  ts: number;
  payload: {
    row: SheetRow;
  };
};

export type StorageWsEvent =
  | DuplicateFileEvent
  | StorageRowUpsertedEvent
  | StorageRowRenamedEvent
  | StorageRowDeletedEvent
  | SheetRowUpdatedEvent
  | { event: string; ts: number; payload: Record<string, unknown> };

export type AutoLogLevel = "debug" | "info" | "success" | "warning" | "error";

export type AutoStepStatus =
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped"
  | "stopped";

export type AutoExecutionStep = {
  id: number;
  executionId: string;
  stepIndex: number;
  stepKey: string;
  stepName: string;
  stepType?: string | null;
  status: AutoStepStatus;
  deviceId?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
  durationMs?: number | null;
  errorMessage?: string | null;
  meta?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type AutoLogEvent = {
  id: number;
  executionId: string;
  stepId?: number | null;
  jobId?: string | null;
  videoId?: string | null;
  deviceId?: string | null;
  level: AutoLogLevel;
  event: string;
  message: string;
  stepIndex?: number | null;
  stepKey?: string | null;
  stepName?: string | null;
  source?: string | null;
  component?: string | null;
  reason?: string | null;
  meta?: Record<string, unknown>;
  screenshotPath?: string | null;
  createdAt: number;
};

export type AutoLogExecutionSummary = {
  id: string;
  jobId: string;
  videoId: string;
  status: string;
  assignedDevice?: string | null;
  startedAt?: number | null;
  finishedAt?: number | null;
};

export type ExecutionAutoLogResponse = {
  execution: AutoLogExecutionSummary | null;
  steps: AutoExecutionStep[];
  logs: AutoLogEvent[];
};
