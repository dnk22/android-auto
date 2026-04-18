interface MediaSocketHandlers {
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent<ArrayBuffer | string>) => void;
}

export function createMediaSocket(wsUrl: string, handlers: MediaSocketHandlers): WebSocket {
  const socket = new WebSocket(wsUrl);
  socket.binaryType = "arraybuffer";

  socket.onopen = () => handlers.onOpen?.();
  socket.onclose = (event) => handlers.onClose?.(event);
  socket.onerror = (event) => handlers.onError?.(event);
  socket.onmessage = (event) => handlers.onMessage?.(event as MessageEvent<ArrayBuffer | string>);

  return socket;
}
