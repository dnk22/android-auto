import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { useControl } from "../../../../hooks/useControl";
import { useStore } from "../../../../store/useStore";
import type {
  MainPreviewState,
  MainStreamControllerResult,
  NormalizedPointer,
  ToolbarAction,
} from "../../../../types/device-workspace/preview.types";

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
    const baseHref = typeof window !== "undefined" ? window.location.href : "http://localhost";
    const streamUrl = new URL(streamWsUrl, baseHref);
    streamUrl.protocol = streamUrl.protocol === "https:" ? "wss:" : "ws:";
    streamUrl.pathname = normalizeControlPath(streamUrl.pathname, deviceId);
    streamUrl.search = "";
    streamUrl.hash = "";
    return streamUrl.toString();
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "unknown_error";
}

export function useMainStreamController(): MainStreamControllerResult {
  const selectedDevice = useStore((state) => state.selectedDevice);
  const selectedStreamDevice = useStore((state) => state.selectedStreamDevice);
  const devices = useStore((state) => state.devices);
  const syncAllDevices = useStore((state) => state.syncAllDevices);
  const addLog = useStore((state) => state.addLog);
  const control = useControl();

  const selectedDeviceInfo = useMemo(
    () =>
      devices.find(
        (device) => device.id === (selectedStreamDevice || selectedDevice),
      ),
    [devices, selectedDevice, selectedStreamDevice],
  );

  const socketRef = useRef<WebSocket | null>(null);
  const controlSocketRef = useRef<WebSocket | null>(null);
  const controlDeviceRef = useRef("");
  const pendingMoveRef = useRef<NormalizedPointer | null>(null);
  const moveRafRef = useRef(0);
  const lastMoveSentAtRef = useRef(0);
  const lastMoveSentRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef({
    active: false,
    x: 0,
    y: 0,
  });

  const [streamState, setStreamState] = useState<MainPreviewState>("idle");
  const activeStreamDevice = selectedStreamDevice || selectedDevice;

  const closeControlSocket = useCallback(() => {
    const socket = controlSocketRef.current;
    controlSocketRef.current = null;
    controlDeviceRef.current = "";

    if (socket && socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }
  }, []);

  const openControlSocket = useCallback((deviceId: string, streamWsUrl: string) => {
    const wsUrl = buildControlWsUrl(streamWsUrl, deviceId);
    if (!wsUrl) {
      addLog(`Control WS URL invalid for stream URL: ${streamWsUrl}`);
      return;
    }

    if (
      controlSocketRef.current
      && controlDeviceRef.current === deviceId
      && controlSocketRef.current.readyState <= WebSocket.OPEN
    ) {
      return;
    }

    closeControlSocket();

    const socket = new WebSocket(wsUrl);
    controlSocketRef.current = socket;
    controlDeviceRef.current = deviceId;

    socket.onopen = () => {
      addLog(`Control WS connected: ${deviceId}`);
    };

    socket.onerror = () => {
      addLog(`Control WS connection error: ${deviceId}`);
    };

    socket.onmessage = (event) => {
      try {
        const payload: unknown = JSON.parse(event.data);
        if (
          payload
          && typeof payload === "object"
          && "type" in payload
          && payload.type === "error"
        ) {
          const message =
            "message" in payload && typeof payload.message === "string"
              ? payload.message
              : "unknown";
          addLog(`Control WS error: ${message}`);
        }
      } catch {
        // ignore malformed control payloads
      }
    };

    socket.onclose = () => {
      if (controlSocketRef.current === socket) {
        controlSocketRef.current = null;
      }
      if (controlDeviceRef.current === deviceId) {
        controlDeviceRef.current = "";
      }
    };
  }, [addLog, closeControlSocket]);

  const getNormalizedPointer = (
    event: PointerEvent<HTMLCanvasElement>,
  ): NormalizedPointer => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };

  const sendControlPointer = useCallback((action: "down" | "move" | "up", x: number, y: number) => {
    const socket = controlSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "pointer",
        action,
        x,
        y,
      }),
    );
  }, []);

  const sendControlKey = useCallback((action: ToolbarAction): boolean => {
    const socket = controlSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    socket.send(
      JSON.stringify({
        type: "key",
        key: action,
      }),
    );
    return true;
  }, []);

  const flushPendingMove = useCallback(() => {
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    moveRafRef.current = 0;
    if (!pending || !dragRef.current.active) {
      return;
    }

    const now = Date.now();
    const sinceLast = now - lastMoveSentAtRef.current;
    const dx = pending.x - lastMoveSentRef.current.x;
    const dy = pending.y - lastMoveSentRef.current.y;
    const distance = Math.hypot(dx, dy);

    if (sinceLast < MOVE_MIN_INTERVAL_MS || distance < MOVE_MIN_DELTA) {
      return;
    }

    sendControlPointer("move", pending.x, pending.y);
    lastMoveSentAtRef.current = now;
    lastMoveSentRef.current = { x: pending.x, y: pending.y };
  }, [sendControlPointer]);

  const scheduleMoveFlush = useCallback(() => {
    if (moveRafRef.current) {
      return;
    }
    moveRafRef.current = window.requestAnimationFrame(() => {
      flushPendingMove();
    });
  }, [flushPendingMove]);

  useEffect(() => {
    const targetDevice = selectedStreamDevice || selectedDevice;
    if (!targetDevice) {
      closeControlSocket();
      return;
    }

    const streamSocket = socketRef.current;
    if (streamSocket && streamSocket.readyState === WebSocket.OPEN) {
      openControlSocket(targetDevice, streamSocket.url);
    }
  }, [closeControlSocket, openControlSocket, selectedDevice, selectedStreamDevice]);

  useEffect(() => () => {
    closeControlSocket();
  }, [closeControlSocket]);

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!(selectedStreamDevice || selectedDevice)) {
      return;
    }

    const { x, y } = getNormalizedPointer(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      x,
      y,
    };
    lastMoveSentAtRef.current = 0;
    lastMoveSentRef.current = { x, y };
    sendControlPointer("down", x, y);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!dragRef.current.active) {
      return;
    }

    const { x, y } = getNormalizedPointer(event);
    dragRef.current.x = x;
    dragRef.current.y = y;
    pendingMoveRef.current = { x, y };
    scheduleMoveFlush();
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>): void => {
    if (!(selectedStreamDevice || selectedDevice)) {
      return;
    }

    const { x, y } = getNormalizedPointer(event);
    dragRef.current.x = x;
    dragRef.current.y = y;

    if (moveRafRef.current) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = 0;
    }

    if (pendingMoveRef.current) {
      const finalMove = pendingMoveRef.current;
      pendingMoveRef.current = null;
      sendControlPointer("move", finalMove.x, finalMove.y);
    }

    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    sendControlPointer("up", x, y);
  };

  const handlePointerLeave = (): void => {
    if (!dragRef.current.active) {
      return;
    }

    if (moveRafRef.current) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = 0;
    }

    pendingMoveRef.current = null;
    sendControlPointer("up", dragRef.current.x, dragRef.current.y);
    dragRef.current.active = false;
  };

  const handleToolbarAction = (action: ToolbarAction): void => {
    const targetDevice = selectedStreamDevice || selectedDevice;
    if (!targetDevice) {
      return;
    }

    const normalizedAction = action === "recents" ? "recents" : action;
    if (!normalizedAction || !["back", "home", "recents"].includes(normalizedAction)) {
      return;
    }

    if (syncAllDevices) {
      addLog(`Toolbar action queued via backend API (broadcast): ${normalizedAction}`);
      void control.broadcastAction(normalizedAction).catch((error: unknown) => {
        addLog(`Toolbar action failed (broadcast): ${getErrorMessage(error)}`);
      });
      return;
    }

    if (sendControlKey(normalizedAction)) {
      addLog(`Toolbar action sent via control WS: ${normalizedAction}`);
      return;
    }

    addLog(`Control WS not ready, fallback backend API: ${normalizedAction}`);
    void control.action(targetDevice, normalizedAction).catch((error: unknown) => {
      addLog(`Toolbar action failed (${targetDevice}): ${getErrorMessage(error)}`);
    });
  };

  const handleSocketReady = (socket: WebSocket): void => {
    socketRef.current = socket;

    const targetDevice = selectedStreamDevice || selectedDevice;
    if (!targetDevice) {
      return;
    }

    openControlSocket(targetDevice, socket.url);
  };

  const handleScreenshot = useCallback(
    (streamShellRef: RefObject<HTMLDivElement | null>) => {
      const shell = streamShellRef?.current;
      if (!shell) {
        return;
      }

      const canvas = shell.querySelector<HTMLCanvasElement>("canvas[data-stream-type='main']");
      if (!canvas) {
        return;
      }

      try {
        const snapshotUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = snapshotUrl;
        link.download = `${activeStreamDevice || "device"}-snapshot-${Date.now()}.png`;
        link.click();
      } catch {
        // ignore screenshot failures caused by browser security/runtime restrictions
      }
    },
    [activeStreamDevice],
  );

  return {
    activeStreamDevice,
    selectedDeviceInfo,
    syncAllDevices,
    streamState,
    setStreamState,
    onSocketReady: handleSocketReady,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    onToolbarAction: handleToolbarAction,
    onScreenshot: handleScreenshot,
  };
}
