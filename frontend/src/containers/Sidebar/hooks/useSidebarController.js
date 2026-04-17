import { useState } from "react";

import {
  connectAllDevices,
  connectDevice,
  disconnectDevice,
  listDevices,
} from "../../../services/api.js";
import { toastAction, getErrorMessage } from "../../../services/feedback.js";
import { useStore } from "../../../store/useStore.js";

export function useSidebarController() {
  const devices = useStore((state) => state.devices);
  const setDevices = useStore((state) => state.setDevices);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const addLog = useStore((state) => state.addLog);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  const [connectingDeviceId, setConnectingDeviceId] = useState("");
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [isDisconnectingAll, setIsDisconnectingAll] = useState(false);

  const refreshDevices = async () => {
    const response = await listDevices();
    setDevices(response.devices || []);
    addLog("Da cap nhat danh sach thiet bi");
  };

  const handleRefreshDevices = async () => {
    try {
      await toastAction(refreshDevices, {
        pending: "Đang tải danh sách thiết bị...",
        success: "Đã cập nhật danh sách thiết bị",
        error: "Không thể tải danh sách thiết bị",
      });
    } catch (error) {
      const message = `Không thể tải danh sách thiết bị: ${getErrorMessage(error, "Không thể tải danh sách thiết bị")}`;
      addLog(message);
    }
  };

  const handleConnect = async (targetDeviceId) => {
    try {
      setConnectingDeviceId(targetDeviceId);
      await toastAction(
        async () => {
          await connectDevice(targetDeviceId);
          setSelectedDevice(targetDeviceId);
          await refreshDevices();
          addLog(`Kết nối thành công với ${targetDeviceId}`);
        },
        {
          pending: `Đang kết nối ${targetDeviceId}...`,
          success: `Đã kết nối ${targetDeviceId}`,
          error: `Lỗi khi kết nối thiết bị ${targetDeviceId}`,
        },
      );
    } catch (error) {
      const message = `Lỗi khi kết nối thiết bị: ${getErrorMessage(error, "Không thể kết nối thiết bị")}`;
      addLog(message);
    } finally {
      setConnectingDeviceId("");
    }
  };

  const handleDisconnect = async (targetDeviceId) => {
    try {
      await toastAction(
        async () => {
          await disconnectDevice(targetDeviceId);
          if (selectedDevice === targetDeviceId) {
            setSelectedDevice("");
          }
          await refreshDevices();
          addLog(`Đã dừng kết nối ${targetDeviceId}`);
        },
        {
          pending: `Đang dừng kết nối ${targetDeviceId}...`,
          success: `Đã dừng kết nối ${targetDeviceId}`,
          error: `Lỗi khi dừng kết nối thiết bị ${targetDeviceId}`,
        },
      );
    } catch (error) {
      const message = `Lỗi khi dừng kết nối thiết bị: ${getErrorMessage(error, "Không thể dừng kết nối thiết bị")}`;
      addLog(message);
    }
  };

  const handleConnectAll = async () => {
    try {
      setIsConnectingAll(true);
      await toastAction(
        async () => {
          await connectAllDevices();
          await refreshDevices();
          addLog("Đã kết nối tất cả thiết bị khả dụng");
        },
        {
          pending: "Đang kết nối tất cả thiết bị...",
          success: "Đã kết nối tất cả thiết bị khả dụng",
          error: "Lỗi khi kết nối tất cả thiết bị",
        },
      );
    } catch (error) {
      const message = `Lỗi khi kết nối tất cả thiết bị: ${getErrorMessage(error, "Không thể kết nối tất cả thiết bị")}`;
      addLog(message);
    } finally {
      setIsConnectingAll(false);
    }
  };

  const handleDisconnectAll = async () => {
    try {
      setIsDisconnectingAll(true);
      await toastAction(
        async () => {
          const connectedDevices = devices.filter((device) => device.connected);
          await Promise.all(
            connectedDevices.map((device) => disconnectDevice(device.id)),
          );
          if (
            selectedDevice &&
            connectedDevices.some((device) => device.id === selectedDevice)
          ) {
            setSelectedDevice("");
          }
          await refreshDevices();
          addLog("Đã dừng kết nối tất cả thiết bị");
        },
        {
          pending: "Đang dừng kết nối tất cả thiết bị...",
          success: "Đã dừng kết nối tất cả thiết bị",
          error: "Lỗi khi dừng kết nối tất cả thiết bị",
        },
      );
    } catch (error) {
      const message = `Lỗi khi dừng kết nối tất cả thiết bị: ${getErrorMessage(error, "Không thể dừng kết nối tất cả thiết bị")}`;
      addLog(message);
    } finally {
      setIsDisconnectingAll(false);
    }
  };

  const getAdbStatusTone = (status) => {
    if (status === "device") {
      return "bg-emerald-500";
    }
    if (status === "offline" || status === "unauthorized") {
      return "bg-amber-500";
    }
    return "bg-rose-500";
  };

  const getU2StatusTone = (status) => {
    if (status === "connected") {
      return "bg-emerald-500";
    }
    if (status === "error" || status === "connecting") {
      return "bg-amber-500";
    }
    return "bg-rose-500";
  };

  const canConnect = (device) => device.adb_status === "device";

  return {
    devices,
    theme,
    toggleTheme,
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
