type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  message?: string;
  deviceId?: string;
  [key: string]: unknown;
}

export const log = (level: LogLevel, payload: LogPayload): void => {
  const line = {
    ts: Math.floor(Date.now() / 1000),
    level,
    service: "frontend",
    ...payload,
  };

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
};
