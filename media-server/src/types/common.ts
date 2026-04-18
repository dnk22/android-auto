export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogPayload {
  ts: number;
  level: LogLevel;
  service: "media";
  event: string;
  message?: string;
  deviceId?: string;
  [key: string]: unknown;
}
