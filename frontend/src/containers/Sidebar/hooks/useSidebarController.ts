import { useState } from "react";

import { fetchDevices } from "../../../api/device.api";
import { useControl } from "../../../hooks/useControl";
import { toastAction, getErrorMessage } from "../../../services/feedback";
import { useStore } from "../../../store/useStore";
import type { LegacyDevice } from "../../../types/device";
import type { AppStore } from "../../../types/store/store.types";
import type { SidebarControllerResult } from "../../../types/sidebar/sidebar.types";

export function useSidebarController(): SidebarControllerResult {
  const devices = useStore((state) => state.devices);
  const setDevices = useStore((state) => state.setDevices);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore(
    (state) => state.setSelectedStreamDevice,
  );
  const selectedDevice = useStore((state) => state.selectedDevice);
  const addLog = useStore((state) => state.addLog);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);
  const control = useControl();

  const [connectingDeviceId, setConnectingDeviceId] = useState("");
  const [isConnectingAll, setIsConnectingAll] = useState(false);
  const [isDisconnectingAll, setIsDisconnectingAll] = useState(false);

  const refreshDevices = async (): Promise<LegacyDevice[]> => {
    const nextDevices = await fetchDevices();
    setDevices(nextDevices);
    addLog("Đã cập nhật danh sách thiết bị");
    return nextDevices;
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

  const handleConnect = async (targetDeviceId: string): Promise<void> => {
    try {
      setConnectingDeviceId(targetDeviceId);
      await toastAction(
        async () => {
          await control.connect(targetDeviceId);
          setSelectedDevice(targetDeviceId);
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

  const handleDisconnect = async (targetDeviceId: string): Promise<void> => {
    try {
      await toastAction(
        async () => {
          await control.disconnect(targetDeviceId);
          if (selectedDevice === targetDeviceId) {
            setSelectedDevice("");
          }
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
          await control.connectAll();
          const refreshedDevices = await refreshDevices();
          const previewDevices = refreshedDevices.filter(
            (device) => String(device.u2_status).toLowerCase() === "connected",
          );
          const firstPreviewDevice = previewDevices[0];

          if (firstPreviewDevice) {
            const currentState = useStore.getState() as AppStore;
            const hasSelectedPreviewDevice = previewDevices.some(
              (device) => device.id === currentState.selectedDevice,
            );

            if (!hasSelectedPreviewDevice) {
              setSelectedDevice(firstPreviewDevice.id);

              const hasSelectedStreamDevice = previewDevices.some(
                (device) => device.id === currentState.selectedStreamDevice,
              );
              if (!hasSelectedStreamDevice) {
                setSelectedStreamDevice(firstPreviewDevice.id);
              }
            }
          }
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
          await control.disconnectAll(
            connectedDevices.map((device) => device.id),
          );
          if (
            selectedDevice &&
            connectedDevices.some((device) => device.id === selectedDevice)
          ) {
            setSelectedDevice("");
          }
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

  const getAdbStatusTone = (status: string): string => {
    if (status === "device") {
      return "bg-emerald-500";
    }
    if (status === "offline" || status === "unauthorized") {
      return "bg-amber-500";
    }
    return "bg-rose-500";
  };

  const getU2StatusTone = (status: string): string => {
    if (status === "connected") {
      return "bg-emerald-500";
    }
    if (status === "error" || status === "connecting") {
      return "bg-amber-500";
    }
    return "bg-rose-500";
  };

  const canConnect = (device: LegacyDevice): boolean =>
    device.adb_status === "device";

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
