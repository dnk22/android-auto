import { create } from "zustand";

const getInitialTheme = () => {
  if (typeof window === "undefined") {
    return "light";
  }
  const savedTheme = window.localStorage.getItem("theme");
  return savedTheme === "dark" ? "dark" : "light";
};

export const useStore = create((set) => ({
  devices: [],
  logs: [],
  selectedDevice: "",
  selectedStreamDevice: "",
  syncAllDevices: false,
  activeStreams: {},
  theme: getInitialTheme(),
  addLog: (message) =>
    set((state) => ({
      logs: [...state.logs, message].slice(-500),
    })),
  setDevices: (devices) => set({ devices }),
  mergeDevice: (device) =>
    set((state) => {
      const nextDevices = state.devices.filter((item) => item.id !== device.id);
      nextDevices.push(device);
      nextDevices.sort((left, right) => left.id.localeCompare(right.id));
      return { devices: nextDevices };
    }),
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),
  setSelectedStreamDevice: (selectedStreamDevice) =>
    set({ selectedStreamDevice }),
  setSyncAllDevices: (syncAllDevices) => set({ syncAllDevices }),
  toggleSyncAllDevices: () =>
    set((state) => ({ syncAllDevices: !state.syncAllDevices })),
  setStreamState: (deviceId, streamState) =>
    set((state) => ({
      activeStreams: {
        ...state.activeStreams,
        [streamState.streamKey || deviceId]: streamState,
      },
    })),
  clearStreamState: (deviceId) =>
    set((state) => {
      const next = { ...state.activeStreams };
      delete next[deviceId];
      return { activeStreams: next };
    }),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  clearLogs: () => set({ logs: [] }),
}));
