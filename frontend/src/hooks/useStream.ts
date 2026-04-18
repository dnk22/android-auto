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

  const disconnect = useCallback(() => {
    setConnected(false);
    setLoading(false);
    cleanupSocket();
  }, [cleanupSocket]);

  const connect = useCallback(() => {
    if (!deviceId || !activeRef.current) {
      return;
    }

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
            handlers.onOpen?.(socket);
          },
          onClose: () => {
            setConnected(false);
            handlers.onClose?.();
            setLoading(false);
          },
          onError: () => {
            setConnected(false);
            setLoading(false);
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
      }
    })();
  }, [cleanupSocket, deviceId, handlers]);

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
