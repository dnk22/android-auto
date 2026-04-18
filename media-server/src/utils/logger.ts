import { config } from "../config";
import type { LogLevel, LogPayload } from "../types/common";

type LogInput = {
  level: LogLevel;
  event: string;
  message?: string;
  deviceId?: string;
} & Record<string, unknown>;

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = levelOrder[config.logLevel];

const shouldLog = (level: LogLevel): boolean => levelOrder[level] >= currentLevel;

export const log = (payload: LogInput): void => {
  if (!shouldLog(payload.level)) {
    return;
  }

  const line: LogPayload = {
    ts: Math.floor(Date.now() / 1000),
    service: "media",
    ...payload,
  };

  process.stdout.write(`${JSON.stringify(line)}\n`);
};
