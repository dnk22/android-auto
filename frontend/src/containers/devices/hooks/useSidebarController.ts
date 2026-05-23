import { useEffect, useState } from "react";

import { fetchDevices } from "../../../api/device.api";
import { useControl } from "../../../hooks/useControl";
import { toastAction, getErrorMessage } from "../../../services/feedback";
import { useStore } from "../../../store/useStore";
import type { LegacyDevice } from "../../../types/device";
import type { SidebarControllerResult } from "../../../types/sidebar/sidebar.types";

const adbStatusTone = new Map<string, string>([
  ["device", "bg-emerald-500"],
  ["offline", "bg-slate-400"],
  ["unknown", "bg-slate-400"],
]);

const u2StatusTone = new Map<string, string>([
  ["connected", "bg-emerald-500"],
  ["connecting", "bg-amber-500"],
  ["error", "bg-rose-500"],
  ["disconnected", "bg-slate-400"],
]);

export function useSidebarController(): SidebarControllerResult {
  const devices = useStore((state) => state.devices);
  const setDevices = useStore((state) => state.setDevices);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore((state) => state.setSelectedStreamDevice);
  const addLog = useStore((state) => state.addLog);
  const control = useControl();

  const [connectingDeviceId, setConnectingDeviceId] = useState("");
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [isDisconnectingAll, setIsDisconnectingAll] = useState(false);

  const refreshDevices = async (): Promise<LegacyDevice[]> => {
    const nextDevices = await fetchDevices();
    setDevices(nextDevices);
    return nextDevices;
  };

  const handleRefreshDevices = async () => {
    try {
      await toastAction(refreshDevices, {
        pending: "Dang tai danh sach thiet bi...",
        success: "Da cap nhat danh sach thiet bi",
        error: "Khong the tai danh sach thiet bi",
      });
    } catch (error) {
      addLog(getErrorMessage(error, "Khong the tai danh sach thiet bi"));
    }
  };

  const handleConnect = async (targetDeviceId: string): Promise<void> => {
    if (!targetDeviceId) {
      return;
    }

    setConnectingDeviceId(targetDeviceId);
    try {
      await toastAction(() => control.connect(targetDeviceId), {
        pending: "Dang ket noi thiet bi...",
        success: "Da ket noi thiet bi",
        error: "Khong the ket noi thiet bi",
      });
      await refreshDevices();
      setSelectedDevice(targetDeviceId);
      setSelectedStreamDevice(targetDeviceId);
    } catch (error) {
      addLog(getErrorMessage(error, "Khong the ket noi thiet bi"));
    } finally {
      setConnectingDeviceId("");
    }
  };

  const handleDisconnect = async (targetDeviceId: string): Promise<void> => {
    if (!targetDeviceId) {
      return;
    }

    setConnectingDeviceId(targetDeviceId);
    try {
      await toastAction(() => control.disconnect(targetDeviceId), {
        pending: "Dang ngat ket noi...",
        success: "Da ngat ket noi",
        error: "Khong the ngat ket noi",
      });
      await refreshDevices();
      if (targetDeviceId === useStore.getState().selectedDevice) {
        setSelectedDevice("");
        setSelectedStreamDevice("");
      }
    } catch (error) {
      addLog(getErrorMessage(error, "Khong the ngat ket noi"));
    } finally {
      setConnectingDeviceId("");
    }
  };

  const handleConnectAll = async (): Promise<void> => {
    if (isConnectingAll || isDisconnectingAll) {
      return;
    }

    setIsConnectingAll(true);
    try {
      await toastAction(() => control.connectAll(), {
        pending: "Dang ket noi tat ca...",
        success: "Da ket noi tat ca",
        error: "Khong the ket noi tat ca",
      });
      await refreshDevices();
    } catch (error) {
      addLog(getErrorMessage(error, "Khong the ket noi tat ca"));
    } finally {
      setIsConnectingAll(false);
    }
  };

  const handleDisconnectAll = async (): Promise<void> => {
    if (isConnectingAll || isDisconnectingAll) {
      return;
    }

    const targetIds = devices.filter((device) => device.connected).map((device) => device.id);
    if (targetIds.length === 0) {
      return;
    }

    setIsDisconnectingAll(true);
    try {
      await toastAction(() => control.disconnectAll(targetIds), {
        pending: "Dang ngat ket noi tat ca...",
        success: "Da ngat ket noi tat ca",
        error: "Khong the ngat ket noi tat ca",
      });
      await refreshDevices();
    } catch (error) {
      addLog(getErrorMessage(error, "Khong the ngat ket noi tat ca"));
    } finally {
      setIsDisconnectingAll(false);
    }
  };

  const canConnect = (device: LegacyDevice): boolean =>
    String(device.adb_status).toLowerCase() === "device" && !device.connected;

  const getAdbStatusTone = (status: string): string =>
    adbStatusTone.get(status.toLowerCase()) ?? "bg-slate-400";

  const getU2StatusTone = (status: string): string =>
    u2StatusTone.get(status.toLowerCase()) ?? "bg-slate-400";

  useEffect(() => {
    void refreshDevices();
  }, []);

  return {
    devices,
    connectingDeviceId,
    isConnectingAll,
    isDisconnectingAll,
    handleRefreshDevices,
    handleConnect,
    handleDisconnect,
    handleConnectAll,
    handleDisconnectAll,
    canConnect,
    getAdbStatusTone,
    getU2StatusTone,
  };
}
