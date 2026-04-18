import { useCallback, useMemo, useRef, useState } from "react";

import { useControl } from "../../../../hooks/useControl.ts";
import { useStore } from "../../../../store/useStore.js";

function clamp(value) {
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function useMainStreamController() {
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

  const socketRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
  const [streamState, setStreamState] = useState("idle");
  const activeStreamDevice = selectedStreamDevice || selectedDevice;

  const sendPointer = (action, event) => {
    const targetDevice = selectedStreamDevice || selectedDevice;
    if (!targetDevice) {
      return;
    }

    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((event.clientX - rect.left) / rect.width);
    const y = clamp((event.clientY - rect.top) / rect.height);
    dragRef.current.x = x;
    dragRef.current.y = y;

    if (action !== "mouseup") {
      return;
    }

    const tapX = Math.round(clamp(x) * 1080);
    const tapY = Math.round(clamp(y) * 1920);

    if (syncAllDevices) {
      void control.broadcastTap(tapX, tapY);
      return;
    }

    void control.tap(targetDevice, tapX, tapY);
  };

  const handlePointerDown = (event) => {
    if (!(selectedStreamDevice || selectedDevice)) {
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
    };
    sendPointer("mousedown", event);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) {
      return;
    }
    sendPointer("mousemove", event);
  };

  const handlePointerUp = (event) => {
    if (!(selectedStreamDevice || selectedDevice)) {
      return;
    }
    dragRef.current.active = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    sendPointer("mouseup", event);
  };

  const handlePointerLeave = () => {
    dragRef.current.active = false;
  };

  const handleToolbarAction = (action) => {
    const targetDevice = selectedStreamDevice || selectedDevice;
    if (!targetDevice) {
      return;
    }

    addLog(`Toolbar action queued via backend API: ${action}`);
    if (syncAllDevices) {
      void control.broadcastTap(540, 960);
      return;
    }
    void control.tap(targetDevice, 540, 960);
  };

  const handleSocketReady = (socket) => {
    socketRef.current = socket;
  };

  const handleScreenshot = useCallback(
    (streamShellRef) => {
      const shell = streamShellRef?.current;
      if (!shell) {
        return;
      }

      const canvas = shell.querySelector("canvas[data-stream-type='main']");
      if (!canvas) {
        return;
      }

      try {
        const snapshotUrl = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = snapshotUrl;
        link.download = `${activeStreamDevice || "device"}-snapshot-${Date.now()}.png`;
        link.click();
      } catch (error) {
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
