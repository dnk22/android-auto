import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Dashboard from "./pages/Dashboard.jsx";
import { useStore } from "./store/useStore.js";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/logs";
const DEVICE_WS_URL =
  import.meta.env.VITE_DEVICE_WS_URL || "ws://localhost:8000/ws/devices";

export default function App() {
  const addLog = useStore((state) => state.addLog);
  const theme = useStore((state) => state.theme);
  const setDevices = useStore((state) => state.setDevices);
  const mergeDevice = useStore((state) => state.mergeDevice);
  const setSelectedDevice = useStore((state) => state.setSelectedDevice);
  const setSelectedStreamDevice = useStore(
    (state) => state.setSelectedStreamDevice
  );

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let socket;
    let isActive = true;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => {
        addLog("WebSocket connected");
      };
      socket.onmessage = (event) => {
        addLog(event.data);
      };
      socket.onerror = () => {
        socket.close();
      };
      socket.onclose = () => {
        if (isActive) {
          addLog("WebSocket disconnected, retrying...");
          setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      isActive = false;
      if (socket) {
        socket.close();
      }
    };
  }, [addLog]);

  useEffect(() => {
    let socket;
    let isActive = true;

    const connect = () => {
      socket = new WebSocket(DEVICE_WS_URL);
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const currentState = useStore.getState();
          if (payload?.type === "device_snapshot" && Array.isArray(payload.data)) {
            setDevices(payload.data);
            if (!currentState.selectedDevice) {
              const connectedDevice = payload.data.find(
                (device) => device.connected
              );
              if (connectedDevice) {
                setSelectedDevice(connectedDevice.id);
                if (!currentState.selectedStreamDevice) {
                  setSelectedStreamDevice(connectedDevice.id);
                }
              }
            }
            return;
          }

          if (payload?.type === "device_update" && payload.data?.id) {
            mergeDevice(payload.data);
            return;
          }
        } catch (error) {
          addLog("Invalid device websocket payload");
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (isActive) {
          setTimeout(connect, 1000);
        }
      };
    };

    connect();

    return () => {
      isActive = false;
      if (socket) {
        socket.close();
      }
    };
  }, [
    addLog,
    mergeDevice,
    setDevices,
    setSelectedDevice,
    setSelectedStreamDevice,
  ]);

  return (
    <>
      <Dashboard />
      <ToastContainer
        position="top-right"
        autoClose={2500}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme={theme === "dark" ? "dark" : "light"}
      />
    </>
  );
}
