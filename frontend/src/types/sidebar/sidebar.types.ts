import type { LegacyDevice } from "../device";

export type DeviceStatusTone = string;

export interface SidebarControllerResult {
  devices: LegacyDevice[];
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
