export type SystemLogLevel =
  | "debug"
  | "info"
  | "success"
  | "warning"
  | "error";

export type SystemLogService =
  | "orchestrator"
  | "automation"
  | "media"
  | "unknown";

export type SystemLogEvent = {
  id: string;
  ts: number;

  service: SystemLogService;
  component?: string;

  level: SystemLogLevel;

  event: string;
  message: string;

  deviceId?: string;

  meta?: Record<string, unknown>;
  raw?: unknown;
};
