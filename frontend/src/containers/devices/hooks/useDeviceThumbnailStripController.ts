import { useMemo, useState } from "react";

import { useControl } from "../../../hooks/useControl";
import { getErrorMessage, toastAction } from "../../../services/feedback";
import { useStore } from "../../../store/useStore";
import type { DeviceThumbnailStripControllerResult } from "../../../types/device-workspace/preview.types";

export function useDeviceThumbnailStripController(): DeviceThumbnailStripControllerResult {
  const devices = useStore((state) => state.devices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const syncAllDevices = useStore((state) => state.syncAllDevices);
  const addLog = useStore((state) => state.addLog);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore((state) => state.setSelectedStreamDevice);
  const toggleSyncAllDevices = useStore((state) => state.toggleSyncAllDevices);
  const [isTestingU2, setIsTestingU2] = useState(false);
  const control = useControl();

  const connectedDevices = useMemo(
    () =>
      devices.filter(
        (device) =>
          String(device.u2_status).toLowerCase() === "connected"
          && String(device.adb_status).toLowerCase() === "device",
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

    setIsTestingU2(true);
    try {
      await toastAction(async () => {
        if (syncAllDevices) {
          await control.testU2All();
          return;
        }

        if (!selectedDevice) {
          throw new Error("Chua chon thiet bi");
        }

        await control.testU2(selectedDevice);
      }, {
        pending: "Dang test U2...",
        success: "Da gui lenh test U2",
        error: "Test U2 that bai",
      });
      addLog("Da gui lenh test U2");
    } catch (error) {
      addLog(getErrorMessage(error, "Test U2 that bai"));
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
