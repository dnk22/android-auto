import { useMemo } from "react";

import { useStore } from "../../../store/useStore.js";

function getBorderClass(state) {
  if (state === "READY") {
    return "border-emerald-500";
  }
  if (state === "U2_ERROR") {
    return "border-rose-500";
  }
  return "border-white";
}

export function useDeviceThumbnailStripController() {
  const devices = useStore((state) => state.devices);
  const selectedDevice = useStore((state) => state.selectedDevice);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore(
    (state) => state.setSelectedStreamDevice,
  );

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
    onSelectDevice: handleSelectDevice,
    getBorderClass,
  };
}
