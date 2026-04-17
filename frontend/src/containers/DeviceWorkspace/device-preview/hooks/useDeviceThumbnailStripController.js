import { useMemo } from "react";

import { useStore } from "../../../../store/useStore.js";

export function useDeviceThumbnailStripController() {
  const devices = useStore((state) => state.devices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const syncAllDevices = useStore((state) => state.syncAllDevices);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore(
    (state) => state.setSelectedStreamDevice,
  );
  const toggleSyncAllDevices = useStore((state) => state.toggleSyncAllDevices);

  const connectedDevices = useMemo(
    () =>
      devices.filter(
        (device) => String(device.u2_status).toLowerCase() === "connected",
      ),
    [devices],
  );

  const handleSelectDevice = (deviceId) => {
    setSelectedDevice(deviceId);
    setSelectedStreamDevice(deviceId);
  };

  return {
    connectedDevices,
    selectedDevice,
    syncAllDevices,
    onSelectDevice: handleSelectDevice,
    toggleSyncAllDevices,
  };
}
