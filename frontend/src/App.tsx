import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import { Navigate, Route, Routes } from "react-router-dom";
import "react-toastify/dist/ReactToastify.css";

import Dashboard from "./pages/Dashboard";
import Devices from "./pages/Devices";
import FilePage from "./pages/File";
import MainLayout from "./layouts/MainLayout";
import { parseLogMessage } from "./containers/logger/normalizeSystemLog";
import { useDevices } from "./hooks/useDevices";
import { useStore } from "./store/useStore";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/logs";

export default function App(): JSX.Element {
  const addLog = useStore((state) => state.addLog);
  const theme = useStore((state) => state.theme);
  useDevices();

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let socket: WebSocket | null = null;

    const connect = () => {
      socket = new WebSocket(WS_URL);
      socket.onopen = () => {
        addLog("WebSocket connected");
      };
      socket.onmessage = (event) => {
        addLog(parseLogMessage(event.data));
      };
      socket.onerror = () => {
        socket?.close();
      };
      socket.onclose = () => {
        addLog("WebSocket disconnected");
      };
    };

    connect();

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [addLog]);

  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/file" element={<FilePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
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
