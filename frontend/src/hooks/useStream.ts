import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getDeviceStream } from "../api/stream.api";
import { createMediaSocket } from "../ws/media.ws";

interface StreamHandlers {
  onOpen?: (socket: WebSocket) => void;
  onClose?: () => void;
  onError?: () => void;
  onMessage?: (event: MessageEvent<ArrayBuffer | string>) => void;
}

export function useStream(
  deviceId: string,
  handlers: StreamHandlers,
): {
  connected: boolean;
  loading: boolean;
  connect: () => void;
  disconnect: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const activeRef = useRef(true);
  const retryRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  const cleanupSocket = useCallback(() => {
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onclose = null;
    socket.onerror = null;
    socket.onmessage = null;
    if (socket.readyState <= WebSocket.OPEN) {
      socket.close();
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    retryRef.current = 0;
    setConnected(false);
    setLoading(false);
    cleanupSocket();
  }, [cleanupSocket, clearReconnectTimer]);

  const connect = useCallback(() => {
    if (!deviceId || !activeRef.current) {
      return;
    }

    clearReconnectTimer();
    void (async () => {
      try {
        setLoading(true);
        const stream = await getDeviceStream(deviceId);

        if (!activeRef.current) {
          return;
        }

        cleanupSocket();

        const socket = createMediaSocket(stream.wsUrl, {
          onOpen: () => {
            setLoading(false);
            setConnected(true);
            retryRef.current = 0;
            handlers.onOpen?.(socket);
          },
          onClose: () => {
            setConnected(false);
            handlers.onClose?.();

            if (!activeRef.current) {
              return;
            }

            if (retryRef.current < 3) {
              retryRef.current += 1;
              const delay = 500 * retryRef.current;
              reconnectTimerRef.current = window.setTimeout(() => {
                reconnectTimerRef.current = null;
                connect();
              }, delay);
              return;
            }

            retryRef.current = 0;
            reconnectTimerRef.current = window.setTimeout(() => {
              reconnectTimerRef.current = null;
              connect();
            }, 1200);
          },
          onError: () => {
            setConnected(false);
            handlers.onError?.();
          },
          onMessage: (event) => {
            handlers.onMessage?.(event);
          },
        });

        socketRef.current = socket;
      } catch {
        setConnected(false);
        setLoading(false);

        if (!activeRef.current) {
          return;
        }

        retryRef.current += 1;
        const delay = Math.min(500 * retryRef.current, 2000);
        reconnectTimerRef.current = window.setTimeout(() => {
          reconnectTimerRef.current = null;
          connect();
        }, delay);
      }
    })();
  }, [cleanupSocket, clearReconnectTimer, deviceId, handlers]);

  useEffect(() => {
    activeRef.current = true;
    disconnect();

    if (deviceId) {
      connect();
    }

    return () => {
      activeRef.current = false;
      disconnect();
    };
  }, [connect, deviceId, disconnect]);

  return useMemo(
    () => ({
      connected,
      loading,
      connect,
      disconnect,
    }),
    [connect, connected, disconnect, loading],
  );
}
