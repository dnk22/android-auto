import type { SessionStatus } from "./session";

export interface DeviceRequest {
  deviceId: string;
}

export interface StreamStatusResponse {
  deviceId: string;
  exists: boolean;
  status: SessionStatus | "NOT_FOUND";
  clients: number;
  lastFrameAt?: number;
  thumbnailAt?: number;
}

export interface ApiMessageResponse {
  ok: boolean;
  message: string;
}
