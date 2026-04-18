import type WebSocket from "ws";

export type SessionStatus = "STARTING" | "RUNNING" | "STOPPED" | "ERROR";

export interface Session {
  deviceId: string;
  status: SessionStatus;
  scrcpy?: {
    process: unknown;
    stream: NodeJS.ReadableStream;
  };
  clients: Set<WebSocket>;
  lastFrame?: Buffer;
  lastFrameAt?: number;
  thumbnail?: Buffer;
  thumbnailAt?: number;
  idleTimer?: NodeJS.Timeout | null;
}
