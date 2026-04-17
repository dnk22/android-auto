import { useEffect, useMemo, useRef, useState } from "react";

import { createStreamSocket } from "../services/mediaStream.js";
import { useStore } from "../store/useStore.js";

const FALLBACK_CODEC = "avc1.42E01E";

function normalizeCodec(codec) {
  const value = String(codec || "").trim().toLowerCase();
  if (!value) {
    return FALLBACK_CODEC;
  }
  if (value === "png") {
    return "png";
  }
  if (value === "h264" || value === "avc") {
    return FALLBACK_CODEC;
  }
  return String(codec);
}

function bytesFromBase64(base64) {
  if (!base64) {
    return undefined;
  }
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isAnnexBKeyFrame(packet) {
  if (!(packet instanceof Uint8Array) || packet.length < 5) {
    return false;
  }

  for (let index = 0; index <= packet.length - 5; index += 1) {
    const startCode =
      packet[index] === 0 &&
      packet[index + 1] === 0 &&
      (packet[index + 2] === 1 || (packet[index + 2] === 0 && packet[index + 3] === 1));

    if (!startCode) {
      continue;
    }

    const nalHeaderIndex = packet[index + 2] === 1 ? index + 3 : index + 4;
    if (nalHeaderIndex >= packet.length) {
      continue;
    }

    const nalType = packet[nalHeaderIndex] & 0x1f;
    if (nalType === 5 || nalType === 7 || nalType === 8) {
      return true;
    }
  }

  return false;
}

export default function H264Decoder({
  serial,
  type = "main",
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
  const frameFormatRef = useRef("h264");
  const frameTokenRef = useRef(0);
  const hasReceivedKeyFrameRef = useRef(false);
  const onSocketReadyRef = useRef(onSocketReady);
  const onFrameStateChangeRef = useRef(onFrameStateChange);
  const onPointerDownRef = useRef(onPointerDown);
  const onPointerMoveRef = useRef(onPointerMove);
  const onPointerUpRef = useRef(onPointerUp);
  const onPointerLeaveRef = useRef(onPointerLeave);
  const streamKind = useMemo(() => type, [type]);
  const streamKey = `${serial}:${streamKind}`;
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
    hasReceivedKeyFrameRef.current = false;

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

    const drawBitmap = (bitmap) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        bitmap.close?.();
        return;
      }

      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close?.();
        return;
      }

      const width = bitmap.width || canvas.width || canvas.clientWidth || 320;
      const height = bitmap.height || canvas.height || canvas.clientHeight || 180;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      context.drawImage(bitmap, 0, 0, width, height);
      bitmap.close?.();
      onFrameStateChangeRef.current?.("rendering");
    };

    const renderPngFrame = async (binaryPayload) => {
      const token = frameTokenRef.current + 1;
      frameTokenRef.current = token;

      try {
        const blob = new Blob([binaryPayload], { type: "image/png" });
        if (window.createImageBitmap) {
          const bitmap = await createImageBitmap(blob);
          if (cancelled || token !== frameTokenRef.current) {
            bitmap.close?.();
            return;
          }
          drawBitmap(bitmap);
          return;
        }

        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.onload = () => {
          if (cancelled || token !== frameTokenRef.current) {
            URL.revokeObjectURL(url);
            return;
          }

          const canvas = canvasRef.current;
          if (!canvas) {
            URL.revokeObjectURL(url);
            return;
          }

          const context = canvas.getContext("2d");
          if (!context) {
            URL.revokeObjectURL(url);
            return;
          }

          if (canvas.width !== image.width || canvas.height !== image.height) {
            canvas.width = image.width;
            canvas.height = image.height;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          onFrameStateChangeRef.current?.("rendering");
        };
        image.onerror = () => {
          URL.revokeObjectURL(url);
          drawFallback("PNG frame decode failed");
          setConnectionState("error");
        };
        image.src = url;
      } catch (error) {
        console.error(error);
          onFrameStateChangeRef.current?.("error");
      }
    };

    const createDecoder = (config) => {
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
          onFrameStateChangeRef.current?.("error");
          setConnectionState("error");
          drawFallback("Decoder error");
        },
      });

      instance.configure(config);
      return instance;
    };

    socket = createStreamSocket(serial, streamKind, {
      onOpen: () => {
        if (cancelled) {
          return;
        }
        setConnectionState("connected");
        setStreamState(streamKey, {
          type: streamKind,
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
          type: streamKind,
          status: "disconnected",
          serial,
          streamKey,
        });
        clearStreamState(streamKey);
        destroyDecoder();
      },
      onError: () => {
        if (cancelled) {
          return;
        }
        setConnectionState("error");
        setStreamState(streamKey, {
          type: streamKind,
          status: "error",
          serial,
          streamKey,
        });
        onFrameStateChangeRef.current?.("error");
      },
      onMessage: (event) => {
        if (cancelled) {
          return;
        }

        if (typeof event.data === "string") {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "config") {
              const resolvedCodec = normalizeCodec(message.codec);
              frameFormatRef.current = String(resolvedCodec).toLowerCase();
              const description = bytesFromBase64(message.description);
              const config = {
                codec: resolvedCodec,
              };
              if (description) {
                config.description = description;
              }
              destroyDecoder();
              if (frameFormatRef.current === "png") {
                drawFallback("Screen capture active");
                decoderRef.current = null;
              } else {
                decoder = createDecoder(config);
                decoderRef.current = decoder;
              }
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

        if (frameFormatRef.current === "png") {
          void renderPngFrame(payload);
          return;
        }

        const isLegacyPrefixedFrame =
          payload.length > 5 &&
          (payload[0] === 0 || payload[0] === 1) &&
          payload[1] === 0 &&
          payload[2] === 0 &&
          payload[3] === 0 &&
          payload[4] === 1;

        const data = isLegacyPrefixedFrame ? payload.slice(1) : payload;
        const isKeyFrame = isLegacyPrefixedFrame
          ? payload[0] === 1
          : isAnnexBKeyFrame(data);

        if (isKeyFrame) {
          hasReceivedKeyFrameRef.current = true;
        }

        if (!hasReceivedKeyFrameRef.current) {
          return;
        }

        if (!decoder) {
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
          timestampRef.current += 33_333;
        } catch (error) {
          console.error(error);
          onFrameStateChangeRef.current?.("error");
        }
      },
    });

    return () => {
      cancelled = true;
      onFrameStateChangeRef.current?.("idle");
      destroyDecoder();
      frameFormatRef.current = "h264";
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [clearStreamState, serial, setStreamState, streamKind]);

  useEffect(() => {
    drawPlaceholder(canvasRef.current, serial, streamKind, connectionState);
  }, [serial, streamKind, connectionState]);

  return (
    <div className={`flex h-full w-full items-center justify-center overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        className="block max-h-full max-w-full rounded-2xl"
        data-serial={serial}
        data-stream-type={streamKind}
        data-interactive={interactive ? "true" : "false"}
        onPointerDown={interactive ? (event) => onPointerDownRef.current?.(event) : undefined}
        onPointerMove={interactive ? (event) => onPointerMoveRef.current?.(event) : undefined}
        onPointerUp={interactive ? (event) => onPointerUpRef.current?.(event) : undefined}
        onPointerLeave={interactive ? (event) => onPointerLeaveRef.current?.(event) : undefined}
      />
    </div>
  );
}

function drawPlaceholder(canvas, serial, type, state) {
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
  context.fillText(serial ? `${serial} (${type})` : "No device selected", 16, 28);
  context.fillStyle = "#94a3b8";
  context.fillText(`State: ${state}`, 16, 52);
}
