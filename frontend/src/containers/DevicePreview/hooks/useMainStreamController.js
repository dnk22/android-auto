import { useMemo, useRef, useState } from "react";

import { sendControl, sendVirtualButton } from "../../../services/mediaStream.js";
import { useStore } from "../../../store/useStore.js";

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
  const toggleSyncAllDevices = useStore((state) => state.toggleSyncAllDevices);
  const selectedDeviceInfo = useMemo(
    () =>
      devices.find(
        (device) => device.id === (selectedStreamDevice || selectedDevice),
      ),
    [devices, selectedDevice, selectedStreamDevice],
  );

  const socketRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0 });
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
    const payload = {
      type: "control",
      action,
      x,
      y,
      target: syncAllDevices ? "all" : "selected",
      serial: targetDevice,
      pointerType: event.pointerType || "mouse",
    };
    sendControl(socketRef.current, payload);
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
    sendVirtualButton(socketRef.current, action, {
      serial: targetDevice,
      target: syncAllDevices ? "all" : "selected",
    });
  };

  const handleSocketReady = (socket) => {
    socketRef.current = socket;
  };

  return {
    activeStreamDevice,
    selectedDeviceInfo,
    syncAllDevices,
    toggleSyncAllDevices,
    streamState,
    setStreamState,
    onSocketReady: handleSocketReady,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerLeave,
    onToolbarAction: handleToolbarAction,
  };
}
