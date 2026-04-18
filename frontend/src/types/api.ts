import type { DeviceState } from "./device";

export interface ApiActionResponse {
  ok: boolean;
  message?: string;
}

export interface DevicesResponse {
  devices: DeviceState[];
}

export interface DeviceUpdateEvent {
  type: "DEVICE_UPDATE";
  deviceId: string;
  state: DeviceState;
}
