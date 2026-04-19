import type { LegacyDevice } from "../device";

export type ThemeMode = "light" | "dark";

export interface StreamViewState {
  type: "main";
  status: "connected" | "disconnected" | "error";
  serial: string;
  streamKey: string;
}

export type ActiveStreamsMap = Record<string, StreamViewState>;

export interface AppStore {
  devices: LegacyDevice[];
  logs: string[];
  selectedDevice: string;
  selectedStreamDevice: string;
  syncAllDevices: boolean;
  activeStreams: ActiveStreamsMap;
  theme: ThemeMode;
  addLog: (message: string) => void;
  setDevices: (devices: LegacyDevice[]) => void;
  mergeDevice: (device: LegacyDevice) => void;
  setSelectedDevice: (selectedDevice: string) => void;
  setSelectedStreamDevice: (selectedStreamDevice: string) => void;
  setSyncAllDevices: (syncAllDevices: boolean) => void;
  toggleSyncAllDevices: () => void;
  setStreamState: (deviceId: string, streamState: StreamViewState) => void;
  clearStreamState: (deviceId: string) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  clearLogs: () => void;
}
