import { apiClient } from "./client";
import { retry } from "../utils/retry";

export async function sendDeviceAction(
  deviceId: string,
  payload: {
    action: string;
    x?: number;
    y?: number;
    x2?: number;
    y2?: number;
    xRatio?: number;
    yRatio?: number;
    x2Ratio?: number;
    y2Ratio?: number;
    durationMs?: number;
  },
): Promise<void> {
  await retry(
    () => apiClient.post(`/devices/${encodeURIComponent(deviceId)}/action`, payload),
    { retries: 2, delayMs: 250 },
  );
}

export async function sendBroadcastAction(payload: {
  action: string;
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  xRatio?: number;
  yRatio?: number;
  x2Ratio?: number;
  y2Ratio?: number;
  durationMs?: number;
  only_connected?: boolean;
}): Promise<void> {
  await retry(() => apiClient.post("/devices/broadcast-action", payload), {
    retries: 2,
    delayMs: 250,
  });
}
