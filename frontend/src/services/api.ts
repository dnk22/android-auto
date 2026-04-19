import {
  connectDeviceApi,
  disconnectDeviceApi,
  fetchDevices,
} from "../api/device.api";
import type { LegacyDevice } from "../types/device";

interface OkResponse {
  ok: true;
}

interface ListDevicesResponse {
  devices: LegacyDevice[];
}

export async function connectDevice(deviceId: string): Promise<OkResponse> {
  await connectDeviceApi(deviceId);
  return { ok: true };
}

export async function listDevices(): Promise<ListDevicesResponse> {
  const devices = await fetchDevices();
  return { devices };
}

export async function disconnectDevice(deviceId: string): Promise<OkResponse> {
  await disconnectDeviceApi(deviceId);
  return { ok: true };
}

export async function connectAllDevices(): Promise<OkResponse> {
  const devices = await fetchDevices();
  await Promise.all(
    devices
      .filter((device) => device.adb && !device.connected)
      .map((device) => connectDeviceApi(device.id)),
  );
  return { ok: true };
}

export async function startJob(deviceId: string): Promise<OkResponse> {
  void deviceId;
  return { ok: true };
}

export async function testU2OpenSettings(deviceId: string): Promise<OkResponse> {
  void deviceId;
  return { ok: true };
}
