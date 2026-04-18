import { useEffect, useRef, useState } from "react";

import { getDeviceStream } from "../api/stream.api.ts";
import { createStreamSocketFromUrl } from "../services/mediaStream.js";
import { useStore } from "../store/useStore.js";

const FALLBACK_CODEC = "avc1.42E01E";
const RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 3;
const TIMESTAMP_STEP = 1;

function parsePrefixedFrame(payload) {
  if (!(payload instanceof Uint8Array) || payload.length < 2) {
    return null;
  }

  const flag = payload[0];
  if (flag !== 0 && flag !== 1) {
    return null;
  }

  return {
    isKeyFrame: flag === 1,
    data: payload.slice(1),
  };
}

export default function H264Decoder({
  serial,
  interactive = false,
  onSocketReady,
  className = "",
  onFrameStateChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}) {
  const canvasRef = useRef(null);
  const decoderRef = useRef(null);
  const timestampRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const hasReceivedKeyFrameRef = useRef(false);
  const onSocketReadyRef = useRef(onSocketReady);
  const onFrameStateChangeRef = useRef(onFrameStateChange);
  const onPointerDownRef = useRef(onPointerDown);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerUpRef = useRef(onPointerUp);
  const onPointerLeaveRef = useRef(onPointerLeave);
  const streamKey = `${serial}:main`;
  const [connectionState, setConnectionState] = useState("idle");
  const setStreamState = useStore((state) => state.setStreamState);
  const clearStreamState = useStore((state) => state.clearStreamState);

  useEffect(() => {
    onSocketReadyRef.current = onSocketReady;
  }, [onSocketReady]);

  useEffect(() => {
    onFrameStateChangeRef.current = onFrameStateChange;
  }, [onFrameStateChange]);

  useEffect(() => {
    onPointerDownRef.current = onPointerDown;
  }, [onPointerDown]);

  useEffect(() => {
    onPointerMoveRef.current = onPointerMove;
  }, [onPointerMove]);

  useEffect(() => {
    onPointerUpRef.current = onPointerUp;
  }, [onPointerUp]);

  useEffect(() => {
    onPointerLeaveRef.current = onPointerLeave;
  }, [onPointerLeave]);

  useEffect(() => {
    if (!serial) {
      return undefined;
    }

    let socket;
    let cancelled = false;
    let decoder;
    let reconnectAttempts = 0;
    hasReceivedKeyFrameRef.current = false;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const destroyDecoder = () => {
      if (decoder) {
        try {
          decoder.close();
        } catch (error) {
          // ignore
        }
      }
      decoder = null;
      decoderRef.current = null;
    };

    const resetDecoderState = () => {
      destroyDecoder();
      hasReceivedKeyFrameRef.current = false;
      timestampRef.current = 0;
    };

    const drawFallback = (label) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      const width = canvas.clientWidth || 320;
      const height = canvas.clientHeight || 180;
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = "#0f172a";
      context.fillRect(0, 0, width, height);
      context.fillStyle = "#cbd5e1";
      context.font = "14px sans-serif";
      context.fillText(label, 16, 28);
    };

    const createDecoder = (codec) => {
      if (!window.VideoDecoder) {
        drawFallback("VideoDecoder is not available in this browser");
        return null;
      }

      const instance = new VideoDecoder({
        output: (frame) => {
          const canvas = canvasRef.current;
          if (!canvas) {
            frame.close();
            return;
          }

          const context = canvas.getContext("2d");
          if (!context) {
            frame.close();
            return;
          }

          const width = frame.displayWidth || frame.codedWidth || canvas.width;
          const height = frame.displayHeight || frame.codedHeight || canvas.height;
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
          }

          context.drawImage(frame, 0, 0, width, height);
          frame.close();
          onFrameStateChangeRef.current?.("rendering");
        },
        error: (error) => {
          console.error(error);
          resetDecoderState();
          onFrameStateChangeRef.current?.("error");
          setConnectionState("error");
          drawFallback("Decoder error");
        },
      });

      instance.configure({
        codec,
        avc: { format: "annexb" },
        optimizeForLatency: true,
        hardwareAcceleration: "prefer-hardware",
      });
      return instance;
    };

    const connect = async () => {
      if (cancelled) {
        return;
      }

      clearReconnectTimer();
      setConnectionState("connecting");

      try {
        const streamInfo = await getDeviceStream(serial);
        if (cancelled) {
          return;
        }

        socket = createStreamSocketFromUrl(streamInfo.wsUrl, {
          onOpen: () => {
            if (cancelled) {
              return;
            }
            reconnectAttempts = 0;
            setConnectionState("connected");
            setStreamState(streamKey, {
              type: "main",
              status: "connected",
              serial,
              streamKey,
            });
            onSocketReadyRef.current?.(socket);
          },
          onClose: () => {
            if (cancelled) {
              return;
            }
            setConnectionState("closed");
            setStreamState(streamKey, {
              type: "main",
              status: "disconnected",
              serial,
              streamKey,
            });
            clearStreamState(streamKey);
            resetDecoderState();
            scheduleReconnect();
          },
          onError: () => {
            if (cancelled) {
              return;
            }
            setConnectionState("error");
            setStreamState(streamKey, {
              type: "main",
              status: "error",
              serial,
              streamKey,
            });
            onFrameStateChangeRef.current?.("error");
            scheduleReconnect();
          },
          onMessage: (event) => {
            if (cancelled) {
              return;
            }

            if (typeof event.data === "string") {
              try {
                const message = JSON.parse(event.data);
                if (message.type === "config") {
                  const codec = String(message.codec || FALLBACK_CODEC);
                  resetDecoderState();
                  decoder = createDecoder(codec);
                  decoderRef.current = decoder;
                  onFrameStateChangeRef.current?.("connected");
                }
              } catch (error) {
                console.error(error);
              }
              return;
            }

            const payload = new Uint8Array(event.data);
            if (payload.length === 0) {
              return;
            }

            const prefixed = parsePrefixedFrame(payload);
            if (!prefixed) {
              return;
            }

            const { data, isKeyFrame } = prefixed;

            if (isKeyFrame) {
              hasReceivedKeyFrameRef.current = true;
            }

            if (!hasReceivedKeyFrameRef.current) {
              return;
            }

            if (!decoder) {
              return;
            }

            if (decoder.state === "closed") {
              decoder = null;
              decoderRef.current = null;
              hasReceivedKeyFrameRef.current = false;
              return;
            }

            try {
              decoder.decode(
                new EncodedVideoChunk({
                  type: isKeyFrame ? "key" : "delta",
                  timestamp: timestampRef.current,
                  data,
                })
              );
              timestampRef.current += TIMESTAMP_STEP;
            } catch (error) {
              console.error(error);
              resetDecoderState();
              onFrameStateChangeRef.current?.("error");
            }
          },
        });
      } catch (error) {
        if (!cancelled) {
          setConnectionState("error");
          scheduleReconnect();
        }
      }
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimerRef.current) {
        return;
      }

      reconnectAttempts += 1;
      const delay = reconnectAttempts <= MAX_RECONNECT_ATTEMPTS
        ? RECONNECT_DELAY_MS
        : RECONNECT_DELAY_MS * 2;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        if (!cancelled) {
          connect();
        }
      }, delay);
    };

    void connect();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      onFrameStateChangeRef.current?.("idle");
      resetDecoderState();
      if (socket && socket.readyState <= WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [clearStreamState, serial, setStreamState, streamKey]);

  useEffect(() => {
    drawPlaceholder(canvasRef.current, serial, connectionState);
  }, [serial, connectionState]);

  return (
    <div className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="block max-h-full max-w-full rounded-2xl"
        data-serial={serial}
        data-stream-type="main"
        data-interactive={interactive ? "true" : "false"}
        onPointerDown={interactive ? (event) => onPointerDownRef.current?.(event) : undefined}
        onPointerMove={interactive ? (event) => onPointerMoveRef.current?.(event) : undefined}
        onPointerUp={interactive ? (event) => onPointerUpRef.current?.(event) : undefined}
        onPointerLeave={interactive ? (event) => onPointerLeaveRef.current?.(event) : undefined}
      />
    </div>
  );
}

function drawPlaceholder(canvas, serial, state) {
  if (!canvas) {
    return;
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 180;
  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "rgba(255,255,255,0.12)";
  context.strokeRect(0, 0, width, height);
  context.fillStyle = "#e2e8f0";
  context.font = "13px sans-serif";
  context.fillText(serial ? `${serial} (main)` : "No device selected", 16, 28);
  context.fillStyle = "#94a3b8";
  context.fillText(`State: ${state}`, 16, 52);
}
