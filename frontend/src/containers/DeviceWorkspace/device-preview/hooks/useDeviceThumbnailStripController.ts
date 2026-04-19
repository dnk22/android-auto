import { useMemo, useState } from "react";

import { useControl } from "../../../../hooks/useControl";
import { getErrorMessage, toastAction } from "../../../../services/feedback";
import { useStore } from "../../../../store/useStore";
import type { DeviceThumbnailStripControllerResult } from "../../../../types/device-workspace/preview.types";

export function useDeviceThumbnailStripController(): DeviceThumbnailStripControllerResult {
  const devices = useStore((state) => state.devices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const syncAllDevices = useStore((state) => state.syncAllDevices);
  const addLog = useStore((state) => state.addLog);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore(
    (state) => state.setSelectedStreamDevice,
  );
  const toggleSyncAllDevices = useStore((state) => state.toggleSyncAllDevices);
  const [isTestingU2, setIsTestingU2] = useState(false);
  const control = useControl();

  const connectedDevices = useMemo(
    () =>
      devices.filter(
        (device) => String(device.u2_status).toLowerCase() === "connected",
      ),
    [devices],
  );

  const handleSelectDevice = (deviceId: string): void => {
    setSelectedDevice(deviceId);
    setSelectedStreamDevice(deviceId);
  };

  const handleTestU2 = async () => {
    if (isTestingU2) {
      return;
    }

    if (!syncAllDevices && !selectedDevice) {
      return;
    }

    try {
      setIsTestingU2(true);
      await toastAction(
        async () => {
          if (syncAllDevices) {
            await control.testU2All();
            addLog("U2 test: da gui lenh den tat ca device dang connected");
            return;
          }

          await control.testU2(selectedDevice);
          addLog(`U2 test: da gui lenh den device active ${selectedDevice}`);
        },
        {
          pending: syncAllDevices
            ? "Đang test U2 cho tất cả device connected..."
            : `Đang test U2 cho ${selectedDevice}...`,
          success: syncAllDevices
            ? "Đã gửi test U2 cho tất cả device connected"
            : `Đã gửi test U2 cho ${selectedDevice}`,
          error: "Không thể gửi test U2",
        },
      );
    } catch (error) {
      addLog(`U2 test lỗi: ${getErrorMessage(error, "Không thể gửi test U2")}`);
    } finally {
      setIsTestingU2(false);
    }
  };

  return {
    connectedDevices,
    selectedDevice,
    syncAllDevices,
    isTestingU2,
    onSelectDevice: handleSelectDevice,
    onTestU2: handleTestU2,
    toggleSyncAllDevices,
  };
}
