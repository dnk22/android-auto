import { apiClient } from "./client";
import { retry } from "../utils/retry";
import { normalizeDevice } from "../types/device";
import type { LegacyDevice } from "../types/device";

interface BackendDevicesResponse {
  devices?: unknown[];
}

export async function fetchDevices(): Promise<LegacyDevice[]> {
  const response = await retry(() => apiClient.get<BackendDevicesResponse>("/devices"), {
    retries: 2,
    delayMs: 200,
  });

  const devices = Array.isArray(response.data.devices) ? response.data.devices : [];
  return devices.map((item) => normalizeDevice((item ?? {}) as Record<string, unknown>));
}

export async function connectDeviceApi(deviceId: string): Promise<void> {
  await retry(
    () => apiClient.post(`/devices/${encodeURIComponent(deviceId)}/connect`),
    { retries: 2, delayMs: 250 },
  );
}

export async function disconnectDeviceApi(deviceId: string): Promise<void> {
  await retry(
    () => apiClient.post(`/devices/${encodeURIComponent(deviceId)}/disconnect`),
    { retries: 2, delayMs: 250 },
  );
}
