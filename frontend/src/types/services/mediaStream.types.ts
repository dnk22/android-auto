export interface StreamSocketHandlers {
  onOpen?: (socket: WebSocket) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessage?: (event: MessageEvent, socket: WebSocket) => void;
}

export interface ThumbFetchOptions {
  signal?: AbortSignal;
}

export type StreamControlPayload = Record<string, unknown>;
