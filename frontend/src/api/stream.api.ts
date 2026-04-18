import { apiClient } from "./client";
import { retry } from "../utils/retry";
import type { StreamResponse } from "../types/stream";

export async function getDeviceStream(deviceId: string): Promise<StreamResponse> {
  const response = await retry(
    () => apiClient.get<StreamResponse>(`/devices/${encodeURIComponent(deviceId)}/stream`),
    { retries: 2, delayMs: 250 },
  );
  return response.data;
}
