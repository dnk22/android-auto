import type WebSocket from "ws";

export type SessionStatus = "STARTING" | "RUNNING" | "STOPPED" | "ERROR";

export interface Session {
  deviceId: string;
  sessionId: string;
  status: SessionStatus;
  scrcpy?: {
    stop: () => Promise<void>;
    injectPointer: (
      action: "down" | "move" | "up",
      xRatio: number,
      yRatio: number,
    ) => Promise<void>;
    injectKey: (key: "back" | "home" | "recents") => Promise<void>;
  };
  clients: Set<WebSocket>;
  controlClients: Set<WebSocket>;
  configuredClients: WeakSet<WebSocket>;
  videoCodec?: string;
  videoWidth?: number;
  videoHeight?: number;
  codecConfig?: Buffer;
  lastFrame?: Buffer;
  lastKeyframe?: Buffer;
  lastKeyframeAt?: number;
  lastFrameAt?: number;
  thumbnail?: Buffer;
  thumbnailAt?: number;
  idleTimer?: NodeJS.Timeout | null;
}
