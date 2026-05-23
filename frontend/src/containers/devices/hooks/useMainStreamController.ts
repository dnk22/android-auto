import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { useControl } from "../../../hooks/useControl";
import { useStore } from "../../../store/useStore";
import type {
  MainPreviewState,
  MainStreamControllerResult,
  NormalizedPointer,
  ToolbarAction,
} from "../../../types/device-workspace/preview.types";

const MOVE_MIN_INTERVAL_MS = 22;
const MOVE_MIN_DELTA = 0.0035;

function clamp(value: number): number {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function normalizeControlPath(streamPathname: string, deviceId: string): string {
  const encodedDeviceId = encodeURIComponent(deviceId);
  const patterns = [/\/stream\/[^/]+\/?$/, /\/ws\/stream\/[^/]+\/?$/];

  for (const pattern of patterns) {
    if (pattern.test(streamPathname)) {
      return streamPathname.replace(pattern, `/ws/control/${encodedDeviceId}`);
    }
  }

  return `/ws/control/${encodedDeviceId}`;
}

function buildControlWsUrl(streamWsUrl: string, deviceId: string): string | null {
  if (!streamWsUrl || !deviceId) {
    return null;
  }

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "http://localhost";
    const url = new URL(streamWsUrl, base);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = normalizeControlPath(url.pathname, deviceId);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizePointer(event: PointerEvent<HTMLCanvasElement>): NormalizedPointer {
  const rect = event.currentTarget.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return { x: 0, y: 0 };
  }
  return {
    x: clamp((event.clientX - rect.left) / rect.width),
    y: clamp((event.clientY - rect.top) / rect.height),
  };
}

export function useMainStreamController(): MainStreamControllerResult {
  const selectedDevice = useStore((state) => state.selectedDevice);
  const selectedStreamDevice = useStore((state) => state.selectedStreamDevice);
  const devices = useStore((state) => state.devices);
  const syncAllDevices = useStore((state) => state.syncAllDevices);
  const control = useControl();

  const [streamState, setStreamState] = useState<MainPreviewState>("idle");

  const activeStreamDevice = selectedStreamDevice || selectedDevice;
  const selectedDeviceInfo = useMemo(
    () => devices.find((device) => device.id === activeStreamDevice),
    [activeStreamDevice, devices],
  );

  const activeDeviceRef = useRef(activeStreamDevice);
  const controlSocketRef = useRef<WebSocket | null>(null);
  const lastMoveRef = useRef<{ position: NormalizedPointer; ts: number } | null>(null);

  useEffect(() => {
    activeDeviceRef.current = activeStreamDevice;
  }, [activeStreamDevice]);

  const closeControlSocket = useCallback(() => {
    if (controlSocketRef.current) {
      controlSocketRef.current.close();
      controlSocketRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    closeControlSocket();
  }, [closeControlSocket]);

  const onSocketReady = useCallback(
    (socket: WebSocket) => {
      const deviceId = activeDeviceRef.current;
      if (!deviceId) {
        return;
      }
      const nextUrl = buildControlWsUrl(socket.url, deviceId);
      if (!nextUrl) {
        return;
      }
      if (
        controlSocketRef.current
        && controlSocketRef.current.url === nextUrl
        && controlSocketRef.current.readyState === WebSocket.OPEN
      ) {
        return;
      }
      closeControlSocket();
      controlSocketRef.current = new WebSocket(nextUrl);
    },
    [closeControlSocket],
  );

  const sendPointerMessage = useCallback(
    (action: "down" | "move" | "up", position: NormalizedPointer) => {
      const socket = controlSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      socket.send(
        JSON.stringify({
          type: "pointer",
          action,
          x: position.x,
          y: position.y,
        }),
      );
    },
    [],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const position = normalizePointer(event);
      lastMoveRef.current = { position, ts: Date.now() };
      sendPointerMessage("down", position);
    },
    [sendPointerMessage],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const position = normalizePointer(event);
      const now = Date.now();
      const lastMove = lastMoveRef.current;

      if (lastMove) {
        const delta = Math.hypot(position.x - lastMove.position.x, position.y - lastMove.position.y);
        if (now - lastMove.ts < MOVE_MIN_INTERVAL_MS && delta < MOVE_MIN_DELTA) {
          return;
        }
      }

      lastMoveRef.current = { position, ts: now };
      sendPointerMessage("move", position);
    },
    [sendPointerMessage],
  );

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const position = normalizePointer(event);
      lastMoveRef.current = { position, ts: Date.now() };
      sendPointerMessage("up", position);
    },
    [sendPointerMessage],
  );

  const onPointerLeave = useCallback(() => {
    if (!lastMoveRef.current) {
      return;
    }
    sendPointerMessage("up", lastMoveRef.current.position);
  }, [sendPointerMessage]);

  const onToolbarAction = useCallback(
    (action: ToolbarAction) => {
      const deviceId = activeDeviceRef.current;
      if (!deviceId) {
        return;
      }

      if (syncAllDevices) {
        void control.broadcastAction(action);
        return;
      }

      void control.action(deviceId, action);
    },
    [control, syncAllDevices],
  );

  const onScreenshot = useCallback(
    (streamShellRef: RefObject<HTMLDivElement | null>) => {
      const shell = streamShellRef.current;
      if (!shell) {
        return;
      }
      const canvas = shell.querySelector("canvas");
      if (!canvas) {
        return;
      }
      try {
        const dataUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `screenshot-${activeDeviceRef.current || "device"}-${Date.now()}.png`;
        link.click();
      } catch {
        return;
      }
    },
    [],
  );

  return {
    activeStreamDevice,
    selectedDeviceInfo,
    syncAllDevices,
    streamState,
    setStreamState,
    onSocketReady,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onToolbarAction,
    onScreenshot,
  };
}
