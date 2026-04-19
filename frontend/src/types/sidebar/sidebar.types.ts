import type { LegacyDevice } from "../device";
import type { ThemeMode } from "../store/store.types";

export type DeviceStatusTone = string;

export interface SidebarControllerResult {
  devices: LegacyDevice[];
  theme: ThemeMode;
  toggleTheme: () => void;
  connectingDeviceId: string;
  isConnectingAll: boolean;
  isDisconnectingAll: boolean;
  handleRefreshDevices: () => Promise<void>;
  handleConnect: (targetDeviceId: string) => Promise<void>;
  handleDisconnect: (targetDeviceId: string) => Promise<void>;
  handleConnectAll: () => Promise<void>;
  handleDisconnectAll: () => Promise<void>;
  canConnect: (device: LegacyDevice) => boolean;
  getAdbStatusTone: (status: string) => DeviceStatusTone;
  getU2StatusTone: (status: string) => DeviceStatusTone;
}
