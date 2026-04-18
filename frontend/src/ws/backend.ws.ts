import { normalizeDevice, type LegacyDevice } from "../types/device";
import { log } from "../utils/logger";

const backendWsUrl =
  import.meta.env.VITE_BACKEND_WS_URL || import.meta.env.VITE_DEVICE_WS_URL || "ws://localhost:8000/ws/devices";

interface Handlers {
  onDeviceUpdate: (device: LegacyDevice) => void;
}

interface Controller {
  close: () => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function createBackendDeviceSocket(handlers: Handlers): Controller {
  let socket: WebSocket | null = null;
  let active = true;

  const connect = () => {
    if (!active) {
      return;
    }

    socket = new WebSocket(backendWsUrl);
    socket.onopen = () => {
      log("info", { event: "backend_ws_open" });
    };

    socket.onmessage = (event) => {
      try {
        const parsed: unknown = JSON.parse(String(event.data));
        if (!isObject(parsed)) {
          return;
        }

        const type = parsed.type;
        const deviceId = parsed.deviceId;
        const state = parsed.state;

        if (type !== "DEVICE_UPDATE" || typeof deviceId !== "string" || !isObject(state)) {
          return;
        }

        handlers.onDeviceUpdate(
          normalizeDevice({
            ...state,
            deviceId,
          }),
        );
      } catch {
        log("warn", { event: "backend_ws_parse_error" });
      }
    };

    socket.onerror = () => {
      socket?.close();
    };

    socket.onclose = () => {
      if (!active) {
        return;
      }
      log("warn", { event: "backend_ws_closed" });
    };
  };

  connect();

  return {
    close: () => {
      active = false;
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    },
  };
}
