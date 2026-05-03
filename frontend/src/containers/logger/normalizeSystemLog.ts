import type { SystemLogEvent, SystemLogLevel, SystemLogService } from "./types";

const createId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const toObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const asOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const normalizeTs = (value: unknown): number => {
  const ts = Number(value);
  if (!Number.isFinite(ts) || ts <= 0) {
    return Date.now();
  }
  return ts < 1_000_000_000_000 ? ts * 1000 : ts;
};

const normalizeService = (value: unknown): SystemLogService => {
  const service = String(value ?? "unknown").toLowerCase();

  if (service === "orchestrator") {
    return "orchestrator";
  }
  if (service === "automation") {
    return "automation";
  }
  if (service === "media") {
    return "media";
  }

  return "unknown";
};

export const normalizeLevel = (level: unknown): SystemLogLevel => {
  const value = String(level ?? "info").toLowerCase();

  if (value === "debug") {
    return "debug";
  }
  if (value === "success") {
    return "success";
  }
  if (value === "warn" || value === "warning") {
    return "warning";
  }
  if (value === "error") {
    return "error";
  }

  return "info";
};

export const parseLogMessage = (data: unknown): unknown => {
  if (typeof data !== "string") {
    return data;
  }

  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export const normalizeSystemLog = (input: unknown): SystemLogEvent => {
  const raw = input;

  if (typeof input === "string") {
    return {
      id: createId(),
      ts: Date.now(),
      service: "unknown",
      component: "raw",
      level: "info",
      event: "raw_log",
      message: input,
      meta: {},
      raw,
    };
  }

  const obj = toObject(input);

  if ((obj.type === "log_event" || obj.type === "system_log") && obj.payload) {
    const payload = toObject(obj.payload);
    return {
      id: asOptionalString(payload.id) ?? createId(),
      ts: normalizeTs(payload.ts),
      service: normalizeService(payload.service),
      component: asOptionalString(payload.component),
      level: normalizeLevel(payload.level),
      event: String(payload.event ?? "log_event"),
      message: String(payload.message ?? payload.event ?? "Log event"),
      deviceId: asOptionalString(payload.deviceId ?? payload.device_id),
      meta: toObject(payload.meta),
      raw,
    };
  }

  if (obj.type && obj.event && obj.level) {
    return {
      id: createId(),
      ts: normalizeTs(obj.ts),
      service: "orchestrator",
      component: String(obj.type).toLowerCase(),
      level: normalizeLevel(obj.level),
      event: String(obj.event),
      message: String(obj.message ?? obj.event),
      deviceId: asOptionalString(obj.deviceId ?? obj.device_id),
      meta: toObject(obj.meta),
      raw,
    };
  }

  if (obj.service === "automation") {
    const meta = toObject(obj.meta);
    return {
      id: createId(),
      ts: normalizeTs(obj.ts),
      service: "automation",
      component: asOptionalString(obj.component),
      level: normalizeLevel(obj.level ?? meta.level ?? "info"),
      event: String(obj.event ?? "automation_log"),
      message: String(obj.message ?? meta.message ?? obj.event ?? "Automation log"),
      deviceId: asOptionalString(
        obj.deviceId ?? obj.device_id ?? meta.deviceId ?? meta.device_id,
      ),
      meta,
      raw,
    };
  }

  if (obj.service === "media") {
    const meta = { ...obj };
    delete meta.service;
    return {
      id: createId(),
      ts: normalizeTs(obj.ts),
      service: "media",
      component: asOptionalString(obj.component ?? "media_server"),
      level: normalizeLevel(obj.level),
      event: String(obj.event ?? "media_log"),
      message: String(obj.message ?? obj.event ?? "Media log"),
      deviceId: asOptionalString(obj.deviceId ?? obj.device_id),
      meta,
      raw,
    };
  }

  return {
    id: createId(),
    ts: Date.now(),
    service: "unknown",
    component: "unknown",
    level: "info",
    event: "unknown_log",
    message: safeStringify(obj),
    meta: {},
    raw,
  };
};
