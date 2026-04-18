import { useMemo, useState } from "react";

import { fetchDevices } from "../../../api/device.api.ts";
import { useControl } from "../../../hooks/useControl.ts";
import { getErrorMessage, toastAction } from "../../../services/feedback.js";
import { useStore } from "../../../store/useStore.js";

export function useDashboardMainController() {
  const devices = useStore((state) => state.devices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const setDevices = useStore((state) => state.setDevices);
  const addLog = useStore((state) => state.addLog);
  const [isTestingU2, setIsTestingU2] = useState(false);
  const control = useControl();

  const selectedDeviceInfo = useMemo(
    () => devices.find((device) => device.id === selectedDevice),
    [devices, selectedDevice],
  );

  const refreshDevices = async () => {
    const devicesResponse = await fetchDevices();
    setDevices(devicesResponse || []);
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

  const handleTestU2OpenSettings = async () => {
    if (!selectedDevice || isTestingU2) {
      return;
    }

    try {
      setIsTestingU2(true);
      await toastAction(
        async () => {
          await control.tap(selectedDevice, 540, 960);
          addLog(`U2 test OK: da mo Settings tren ${selectedDevice}`);
          await refreshDevices();
        },
        {
          pending: `Đang mở Settings trên ${selectedDevice}...`,
          success: `Đã mở Settings trên ${selectedDevice}`,
          error: `U2 test lỗi trên ${selectedDevice}`,
        },
      );
    } catch (error) {
      const message = `U2 test lỗi trên ${selectedDevice}: ${getErrorMessage(error, "Không thể mở Settings")}`;
      addLog(message);
    } finally {
      setIsTestingU2(false);
    }
  };

  return {
    selectedDevice,
    selectedDeviceInfo,
    isTestingU2,
    handleRefreshDevices,
    handleTestU2OpenSettings,
  };
}
