const STREAM_WS_URL =
  import.meta.env.VITE_STREAM_WS_URL || "ws://localhost:3001";

export function buildStreamUrl(serial, type) {
  const params = new URLSearchParams({ profile: type, type });
  return `${STREAM_WS_URL}/stream/${encodeURIComponent(serial)}?${params.toString()}`;
}

export function createStreamSocket(serial, type, handlers = {}) {
  if (!serial) {
    throw new Error("serial is required");
  }

  const socket = new WebSocket(buildStreamUrl(serial, type));
  socket.binaryType = "arraybuffer";

  socket.onopen = () => handlers.onOpen?.(socket);
  socket.onclose = (event) => handlers.onClose?.(event);
  socket.onerror = (event) => handlers.onError?.(event);
  socket.onmessage = (event) => handlers.onMessage?.(event, socket);

  return socket;
}

export function sendControl(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

export function sendVirtualButton(socket, action, payload = {}) {
  sendControl(socket, {
    type: "control",
    action,
    ...payload,
  });
}
