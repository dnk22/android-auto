import { useMemo } from "react";
import { connectDeviceApi, disconnectDeviceApi, fetchDevices } from "../api/device.api";
import { sendBroadcastAction, sendDeviceAction } from "../api/control.api";

export function useControl(): {
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  connectAll: () => Promise<void>;
  disconnectAll: (deviceIds: string[]) => Promise<void>;
  action: (deviceId: string, action: "back" | "home" | "recents") => Promise<void>;
  broadcastAction: (action: "back" | "home" | "recents") => Promise<void>;
} {
  return useMemo(
    () => ({
      connect: (deviceId: string) => connectDeviceApi(deviceId),
      disconnect: (deviceId: string) => disconnectDeviceApi(deviceId),
      connectAll: async () => {
        const devices = await fetchDevices();
        const connectable = devices.filter((item) => item.adb && !item.connected);
        await Promise.all(connectable.map((item) => connectDeviceApi(item.id)));
      },
      disconnectAll: async (deviceIds: string[]) => {
        await Promise.all(deviceIds.map((deviceId) => disconnectDeviceApi(deviceId)));
      },
      action: (deviceId: string, action: "back" | "home" | "recents") =>
        sendDeviceAction(deviceId, { action }),
      broadcastAction: (action: "back" | "home" | "recents") =>
        sendBroadcastAction({ action, only_connected: true }),
    }),
    [],
  );
}
