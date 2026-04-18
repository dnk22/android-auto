export type StreamStatus = "STOPPED" | "STARTING" | "RUNNING" | "ERROR";

export interface DeviceState {
  deviceId: string;
  adb: boolean;
  u2: boolean;
  stream: StreamStatus;
  mediaNodeId?: string;
  lastSeen: number;
  lastFrameAt?: number;
}

export interface LegacyDevice extends DeviceState {
  id: string;
  connected: boolean;
  adb_status: "device" | "offline";
  u2_status: "connected" | "disconnected" | "connecting" | "error";
  stream_status: StreamStatus;
}

interface BackendDeviceStatePayload {
  device_id?: string;
  deviceId?: string;
  adb?: boolean;
  u2?: boolean;
  stream?: StreamStatus;
  media_node_id?: string | null;
  mediaNodeId?: string | null;
  last_seen?: number;
  lastSeen?: number;
  last_frame_at?: number | null;
  lastFrameAt?: number | null;
}

export const normalizeDevice = (input: BackendDeviceStatePayload): LegacyDevice => {
  const deviceId = String(input.device_id ?? input.deviceId ?? "");
  const adb = Boolean(input.adb);
  const u2 = Boolean(input.u2);
  const stream = (input.stream ?? "STOPPED") as StreamStatus;
  const mediaNodeIdRaw = input.media_node_id ?? input.mediaNodeId;
  const mediaNodeId = mediaNodeIdRaw ?? undefined;
  const lastSeen = Number(input.last_seen ?? input.lastSeen ?? Date.now() / 1000);
  const lastFrameRaw = input.last_frame_at ?? input.lastFrameAt;
  const lastFrameAt = lastFrameRaw ?? undefined;

  const u2Status = u2
    ? "connected"
    : stream === "STARTING"
      ? "connecting"
      : stream === "ERROR"
        ? "error"
        : "disconnected";

  return {
    id: deviceId,
    deviceId,
    adb,
    u2,
    stream,
    stream_status: stream,
    mediaNodeId,
    lastSeen,
    lastFrameAt,
    connected: u2,
    adb_status: adb ? "device" : "offline",
    u2_status: u2Status,
  };
};
