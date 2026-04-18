import {
  connectDeviceApi,
  disconnectDeviceApi,
  fetchDevices,
} from "../api/device.api.ts";

export async function connectDevice(deviceId) {
  await connectDeviceApi(deviceId);
  return { ok: true };
}

export async function listDevices() {
  const devices = await fetchDevices();
  return { devices };
}

export async function disconnectDevice(deviceId) {
  await disconnectDeviceApi(deviceId);
  return { ok: true };
}

export async function connectAllDevices() {
  const devices = await fetchDevices();
  await Promise.all(
    devices
      .filter((device) => device.adb && !device.connected)
      .map((device) => connectDeviceApi(device.id)),
  );
  return { ok: true };
}

export async function startJob(deviceId) {
  return { ok: true };
}

export async function testU2OpenSettings(deviceId) {
  return { ok: true };
}
