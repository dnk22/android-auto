import { apiClient } from "./client";
import { retry } from "../utils/retry";
import type { StreamResponse } from "../types/stream";

const toProxyMediaUrl = (wsUrl: string): string => {
  try {
    const parsed = new URL(wsUrl, window.location.origin);
    return `/media${parsed.pathname}`;
  } catch {
    return wsUrl.replace(/^wss?:\/\/[^/]+/i, "/media");
  }
};

export async function getDeviceStream(deviceId: string): Promise<StreamResponse> {
  const response = await retry(
    () => apiClient.get<StreamResponse>(`/devices/${encodeURIComponent(deviceId)}/stream`),
    { retries: 2, delayMs: 250 },
  );
  return {
    ...response.data,
    wsUrl: toProxyMediaUrl(response.data.wsUrl),
  };
}
