export interface AppConfig {
  port: number;
  host: string;
  idleTimeoutMs: number;
  thumbnailIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
}

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toLogLevel = (
  value: string | undefined,
): "debug" | "info" | "warn" | "error" => {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
};

export const config: AppConfig = {
  port: toNumber(process.env.MEDIA_PORT, 9100),
  host: process.env.MEDIA_HOST ?? "0.0.0.0",
  idleTimeoutMs: toNumber(process.env.MEDIA_IDLE_TIMEOUT_MS, 30_000),
  thumbnailIntervalMs: toNumber(process.env.MEDIA_THUMBNAIL_INTERVAL_MS, 5_000),
  logLevel: toLogLevel(process.env.MEDIA_LOG_LEVEL),
};
