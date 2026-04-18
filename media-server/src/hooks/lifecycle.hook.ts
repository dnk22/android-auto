import { log } from "../utils/logger";

export interface LifecycleHook {
  onSessionStart(deviceId: string): void;
  onSessionStop(deviceId: string, reason: string): void;
  onClientConnect(deviceId: string, totalClients: number): void;
  onClientDisconnect(deviceId: string, totalClients: number): void;
}

export const lifecycleHook: LifecycleHook = {
  onSessionStart(deviceId) {
    log({ level: "info", event: "session_start", deviceId });
  },
  onSessionStop(deviceId, reason) {
    log({ level: "info", event: "session_stop", deviceId, reason });
  },
  onClientConnect(deviceId, totalClients) {
    log({ level: "info", event: "client_connect", deviceId, totalClients });
  },
  onClientDisconnect(deviceId, totalClients) {
    log({ level: "info", event: "client_disconnect", deviceId, totalClients });
  },
};
