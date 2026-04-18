import type WebSocket from "ws";

export type SessionStatus = "STARTING" | "RUNNING" | "STOPPED" | "ERROR";

export interface Session {
  deviceId: string;
  status: SessionStatus;
  scrcpy?: {
    stop: () => Promise<void>;
  };
  clients: Set<WebSocket>;
  videoCodec?: "h264";
  videoWidth?: number;
  videoHeight?: number;
  codecConfig?: Buffer;
  lastFrame?: Buffer;
  lastKeyframe?: Buffer;
  lastFrameAt?: number;
  thumbnail?: Buffer;
  thumbnailAt?: number;
  idleTimer?: NodeJS.Timeout | null;
}
