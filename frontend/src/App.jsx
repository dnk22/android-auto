import { useEffect } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Dashboard from "./pages/Dashboard.jsx";
import { useDevices } from "./hooks/useDevices.ts";
import { useStore } from "./store/useStore.js";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/logs";

export default function App() {
  const addLog = useStore((state) => state.addLog);
  const theme = useStore((state) => state.theme);
  useDevices();

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    window.localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    let socket;

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
