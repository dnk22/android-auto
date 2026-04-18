export interface AppConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  idleTimeoutMs: number;
  thumbnailIntervalMs: number;
  logLevel: "debug" | "info" | "warn" | "error";
  adbServerHost: string;
  adbServerPort: number;
  scrcpyServerDevicePath: string;
  scrcpyServerLocalPath?: string;
  scrcpyClientVersion?: string;
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

const toOrigins = (value: string | undefined): string[] => {
  const raw = value ?? "*";
  const parts = raw.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
  if (parts.length === 0) {
    return ["*"];
  }

  if (parts.includes("*")) {
    return ["*"];
  }

  const localDevOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  return Array.from(new Set([...parts, ...localDevOrigins]));
};

export const config: AppConfig = {
  port: toNumber(process.env.MEDIA_PORT, 9100),
  host: process.env.MEDIA_HOST ?? "0.0.0.0",
  corsOrigins: toOrigins(process.env.MEDIA_CORS_ORIGINS),
  idleTimeoutMs: toNumber(process.env.MEDIA_IDLE_TIMEOUT_MS, 30_000),
  thumbnailIntervalMs: toNumber(process.env.MEDIA_THUMBNAIL_INTERVAL_MS, 5_000),
  logLevel: toLogLevel(process.env.MEDIA_LOG_LEVEL),
  adbServerHost: process.env.MEDIA_ADB_SERVER_HOST ?? "127.0.0.1",
  adbServerPort: toNumber(process.env.MEDIA_ADB_SERVER_PORT, 5037),
  scrcpyServerDevicePath:
    process.env.MEDIA_SCRCPY_SERVER_DEVICE_PATH ?? "/data/local/tmp/scrcpy-server.jar",
  scrcpyServerLocalPath: process.env.MEDIA_SCRCPY_SERVER_LOCAL_PATH,
  scrcpyClientVersion: process.env.MEDIA_SCRCPY_CLIENT_VERSION,
};
