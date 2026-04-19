import type {
  StreamControlPayload,
  StreamSocketHandlers,
  ThumbFetchOptions,
} from "../types/services/mediaStream.types";

const STREAM_WS_URL_RAW =
  import.meta.env.VITE_STREAM_WS_URL || "ws://localhost:9100";

const STREAM_WS_URL = STREAM_WS_URL_RAW.replace(/\/+$/, "");

const STREAM_HTTP_URL_RAW =
  import.meta.env.VITE_STREAM_HTTP_URL ||
  import.meta.env.VITE_MEDIA_HTTP_URL ||
  STREAM_WS_URL.replace(/^ws:/i, "http:").replace(/^wss:/i, "https:");

const STREAM_HTTP_URL = STREAM_HTTP_URL_RAW.replace(/\/+$/, "");

export function buildStreamUrl(serial: string): string {
  return `${STREAM_WS_URL}/stream/${encodeURIComponent(serial)}`;
}

export function buildThumbUrl(serial: string): string {
  return `${STREAM_HTTP_URL}/thumbnail/${encodeURIComponent(serial)}`;
}

export function createStreamSocket(
  serial: string,
  handlers: StreamSocketHandlers = {},
): WebSocket {
  if (!serial) {
    throw new Error("serial is required");
  }

  return createStreamSocketFromUrl(buildStreamUrl(serial), handlers);
}

export function createStreamSocketFromUrl(
  wsUrl: string,
  handlers: StreamSocketHandlers = {},
): WebSocket {
  const socket = new WebSocket(wsUrl);
  socket.binaryType = "arraybuffer";

  socket.onopen = () => handlers.onOpen?.(socket);
  socket.onclose = (event) => handlers.onClose?.(event);
  socket.onerror = (event) => handlers.onError?.(event);
  socket.onmessage = (event) => handlers.onMessage?.(event, socket);

  return socket;
}

export function sendControl(
  socket: WebSocket | null | undefined,
  payload: StreamControlPayload,
): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

export function sendVirtualButton(
  socket: WebSocket | null | undefined,
  action: string,
  payload: StreamControlPayload = {},
): void {
  sendControl(socket, {
    type: "control",
    action,
    ...payload,
  });
}

export async function fetchThumbImage(
  serial: string,
  options: ThumbFetchOptions = {},
): Promise<Blob | null> {
  const response = await fetch(buildThumbUrl(serial), {
    method: "GET",
    cache: "no-store",
    signal: options.signal,
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`thumb_request_failed:${response.status}`);
  }

  return response.blob();
}
