import type { PointerEvent, RefObject } from "react";
import type { LegacyDevice } from "../device";

export type ThumbStatus = "idle" | "loading" | "ready" | "error";

export interface ThumbPollingImageProps {
  serial: string;
  className?: string;
}

export interface DeviceThumbnailStripControllerResult {
  connectedDevices: LegacyDevice[];
  selectedDevice: string;
  syncAllDevices: boolean;
  isTestingU2: boolean;
  onSelectDevice: (deviceId: string) => void;
  onTestU2: () => Promise<void>;
  toggleSyncAllDevices: () => void;
}

export type MainPreviewState = "idle" | "connected" | "rendering" | "error" | "closed" | "connecting";

export type ToolbarAction = "back" | "home" | "recents";

export interface NormalizedPointer {
  x: number;
  y: number;
}

export interface MainStreamControllerResult {
  activeStreamDevice: string;
  selectedDeviceInfo?: LegacyDevice;
  syncAllDevices: boolean;
  streamState: MainPreviewState;
  setStreamState: (next: MainPreviewState) => void;
  onSocketReady: (socket: WebSocket) => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onToolbarAction: (action: ToolbarAction) => void;
  onScreenshot: (streamShellRef: RefObject<HTMLDivElement | null>) => void;
}
