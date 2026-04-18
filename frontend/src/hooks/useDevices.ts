import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchDevices } from "../api/device.api";
import { createBackendDeviceSocket } from "../ws/backend.ws";
import type { LegacyDevice } from "../types/device";
import { useStore } from "../store/useStore.js";

const sortById = (items: LegacyDevice[]): LegacyDevice[] => {
  const copy = [...items];
  copy.sort((left, right) => left.id.localeCompare(right.id));
  return copy;
};

export function useDevices(): {
  loading: boolean;
  error: string;
  refresh: () => Promise<LegacyDevice[]>;
} {
  const setDevices = useStore((state) => state.setDevices);
  const mergeDevice = useStore((state) => state.mergeDevice);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore((state) => state.setSelectedStreamDevice);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const applySelection = useCallback((devices: LegacyDevice[]) => {
    const current = useStore.getState();

    if (current.selectedDevice && devices.some((item) => item.id === current.selectedDevice)) {
      return;
    }

    const connected = devices.find((item) => item.connected);
    if (connected) {
      setSelectedDevice(connected.id);
      if (!current.selectedStreamDevice || !devices.some((item) => item.id === current.selectedStreamDevice)) {
        setSelectedStreamDevice(connected.id);
      }
      return;
    }

    setSelectedDevice("");
  }, [setSelectedDevice, setSelectedStreamDevice]);

  const refresh = useCallback(async (): Promise<LegacyDevice[]> => {
    const devices = sortById(await fetchDevices());
    setDevices(devices);
    applySelection(devices);
    setError("");
    return devices;
  }, [applySelection, setDevices]);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      try {
        await refresh();
      } catch (err) {
        if (mounted) {
          setDevices([]);
          setError(err instanceof Error ? err.message : "load_devices_failed");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    })();

    const ws = createBackendDeviceSocket({
      onDeviceUpdate: (device) => {
        mergeDevice(device);
      },
    });

    return () => {
      mounted = false;
      ws.close();
    };
  }, [mergeDevice, refresh, setDevices]);

  return useMemo(
    () => ({
      loading,
      error,
      refresh,
    }),
    [error, loading, refresh],
  );
}
