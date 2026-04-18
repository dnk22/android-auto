import { useEffect, useRef, useState } from "react";

import { getDeviceStream } from "../api/stream.api.ts";
import { createStreamSocketFromUrl } from "../services/mediaStream.js";
import { useStore } from "../store/useStore.js";

const FALLBACK_CODEC = "avc1.42E01E";
const MAX_DECODE_QUEUE = 8;
const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 3000;
const FRAME_HEADER_BYTES = 9;

function base64ToUint8Array(value) {
  if (!value) {
    return null;
  }

  const binary = atob(String(value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isStartCode(buffer, offset) {
  return (
    buffer[offset] === 0x00 &&
    buffer[offset + 1] === 0x00 &&
    (buffer[offset + 2] === 0x01 || (buffer[offset + 2] === 0x00 && buffer[offset + 3] === 0x01))
  );
}

function findNaluRanges(buffer) {
  const ranges = [];
  let cursor = 0;

  while (cursor < buffer.length - 3) {
    let start = -1;
    let startSize = 0;

    for (let index = cursor; index < buffer.length - 3; index += 1) {
      if (isStartCode(buffer, index)) {
        start = index;
        startSize = buffer[index + 2] === 0x01 ? 3 : 4;
        break;
      }
    }

    if (start === -1) {
      break;
    }

    const payloadStart = start + startSize;
    let nextStart = buffer.length;

    for (let index = payloadStart; index < buffer.length - 3; index += 1) {
      if (isStartCode(buffer, index)) {
        nextStart = index;
        break;
      }
    }

    ranges.push({ payloadStart, nextStart });
    cursor = nextStart;
  }

  return ranges;
}

function deriveCodecFromConfig(codecConfig) {
  if (!(codecConfig instanceof Uint8Array) || codecConfig.length < 4) {
    return FALLBACK_CODEC;
  }

  if (codecConfig[0] === 0x01 && codecConfig.length >= 4) {
    return `avc1.${codecConfig[1].toString(16).padStart(2, "0")}${codecConfig[2]
      .toString(16)
      .padStart(2, "0")}${codecConfig[3].toString(16).padStart(2, "0")}`;
  }

  for (const range of findNaluRanges(codecConfig)) {
    const nalType = codecConfig[range.payloadStart] & 0x1f;
    if (nalType === 7 && range.payloadStart + 3 < codecConfig.length) {
      return `avc1.${codecConfig[range.payloadStart + 1]
        .toString(16)
        .padStart(2, "0")}${codecConfig[range.payloadStart + 2]
        .toString(16)
        .padStart(2, "0")}${codecConfig[range.payloadStart + 3]
        .toString(16)
        .padStart(2, "0")}`;
    }
  }

  return FALLBACK_CODEC;
}

function buildAvcDecoderDescription(codecConfig) {
  if (!(codecConfig instanceof Uint8Array) || codecConfig.length === 0) {
    return null;
  }

  if (codecConfig[0] === 0x01) {
    return codecConfig;
  }

  let sps = null;
  let pps = null;

  for (const range of findNaluRanges(codecConfig)) {
    const nalType = codecConfig[range.payloadStart] & 0x1f;
    const nalu = codecConfig.slice(range.payloadStart, range.nextStart);
    if (nalType === 7 && !sps) {
      sps = nalu;
    }
    if (nalType === 8 && !pps) {
      pps = nalu;
    }

    if (sps && pps) {
      break;
    }
  }

  if (!sps || !pps || sps.length < 4 || pps.length === 0) {
    return null;
  }

  const description = new Uint8Array(11 + sps.length + pps.length);
  description[0] = 0x01;
  description[1] = sps[1];
  description[2] = sps[2];
  description[3] = sps[3];
  description[4] = 0xfc | 3;
  description[5] = 0xe0 | 1;
  description[6] = (sps.length >> 8) & 0xff;
  description[7] = sps.length & 0xff;
  description.set(sps, 8);
  const ppsCountIndex = 8 + sps.length;
  description[ppsCountIndex] = 0x01;
  description[ppsCountIndex + 1] = (pps.length >> 8) & 0xff;
  description[ppsCountIndex + 2] = pps.length & 0xff;
  description.set(pps, ppsCountIndex + 3);

  return description;
}

function convertAvcConfigToAnnexB(codecConfig) {
  if (!(codecConfig instanceof Uint8Array) || codecConfig.length === 0) {
    return null;
  }

  if (codecConfig[0] !== 0x01) {
    return codecConfig;
  }

  if (codecConfig.length < 7) {
    return null;
  }

  let offset = 5;
  const spsCount = codecConfig[offset] & 0x1f;
  offset += 1;

  const chunks = [];
  const startCode = new Uint8Array([0x00, 0x00, 0x00, 0x01]);

  for (let i = 0; i < spsCount; i += 1) {
    if (offset + 2 > codecConfig.length) {
      return null;
    }
    const size = (codecConfig[offset] << 8) | codecConfig[offset + 1];
    offset += 2;
    if (offset + size > codecConfig.length) {
      return null;
    }
    chunks.push(startCode, codecConfig.slice(offset, offset + size));
    offset += size;
  }

  if (offset >= codecConfig.length) {
    return null;
  }

  const ppsCount = codecConfig[offset];
  offset += 1;
  for (let i = 0; i < ppsCount; i += 1) {
    if (offset + 2 > codecConfig.length) {
      return null;
    }
    const size = (codecConfig[offset] << 8) | codecConfig[offset + 1];
    offset += 2;
    if (offset + size > codecConfig.length) {
      return null;
    }
    chunks.push(startCode, codecConfig.slice(offset, offset + size));
    offset += size;
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let cursor = 0;
  for (const chunk of chunks) {
    result.set(chunk, cursor);
    cursor += chunk.length;
  }

  return result;
}

function hasSpsOrPpsNalu(frameData) {
  if (!(frameData instanceof Uint8Array) || frameData.length < 5) {
    return false;
  }

  for (const range of findNaluRanges(frameData)) {
    const nalType = frameData[range.payloadStart] & 0x1f;
    if (nalType === 7 || nalType === 8) {
      return true;
    }
  }

  return false;
}

function concatUint8Arrays(first, second) {
  const out = new Uint8Array(first.length + second.length);
  out.set(first, 0);
  out.set(second, first.length);
  return out;
}

function normalizeCodec(codec, codecConfig) {
  const value = String(codec || "").toLowerCase();
  if (value.startsWith("avc1.")) {
    return String(codec);
  }

  if (value === "h264" || value === "avc" || !value) {
    return deriveCodecFromConfig(codecConfig);
  }

  return String(codec || FALLBACK_CODEC);
}

function parseBinaryFrame(payload) {
  if (!(payload instanceof Uint8Array) || payload.length < FRAME_HEADER_BYTES + 1) {
    return null;
  }

  const flag = payload[0];
  if (flag !== 0 && flag !== 1) {
    return null;
  }

  const timestampView = new DataView(payload.buffer, payload.byteOffset + 1, 8);
  const timestampMs = Number(timestampView.getBigUint64(0, false));

  return {
    isKeyFrame: flag === 1,
    timestampUs: Math.max(0, Math.trunc(timestampMs * 1000)),
    data: payload.slice(FRAME_HEADER_BYTES),
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
  const hasReceivedKeyFrameRef = useRef(false);
  const hasLoggedFirstFrameRef = useRef(false);
  const hasConfigRef = useRef(false);
  const codecConfigAnnexBRef = useRef(null);
  const lastTimestampUsRef = useRef(0);
  const sessionIdRef = useRef("");
  const connectEpochRef = useRef(0);
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
    let connecting = false;
    let reconnectAttempt = 0;
    let reconnectTimer = null;
    let decoder;
    const connectEpoch = connectEpochRef.current + 1;
    connectEpochRef.current = connectEpoch;
    hasReceivedKeyFrameRef.current = false;
    hasLoggedFirstFrameRef.current = false;
    hasConfigRef.current = false;
    codecConfigAnnexBRef.current = null;
    lastTimestampUsRef.current = 0;
    sessionIdRef.current = "";

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
      hasLoggedFirstFrameRef.current = false;
      hasConfigRef.current = false;
      codecConfigAnnexBRef.current = null;
      lastTimestampUsRef.current = 0;
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) {
        return;
      }

      clearReconnectTimer();

      const delay = Math.min(
        RECONNECT_MAX_DELAY_MS,
        RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
      );
      reconnectAttempt += 1;

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
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
          if (!hasLoggedFirstFrameRef.current) {
            hasLoggedFirstFrameRef.current = true;
            console.info("[H264Decoder] first frame decoded", { serial });
          }

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
          console.error("[H264Decoder] decoder error", { serial, error });
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

      console.info("[H264Decoder] decoder configured", {
        serial,
        codec,
        annexBConfigBytes: codecConfigAnnexBRef.current?.byteLength ?? 0,
      });
      return instance;
    };

    const connect = async () => {
      if (cancelled || connecting) {
        return;
      }

      connecting = true;

      setConnectionState("connecting");

      try {
        const streamInfo = await getDeviceStream(serial);
        if (connectEpoch !== connectEpochRef.current) {
          connecting = false;
          return;
        }

        connecting = false;
        if (cancelled) {
          return;
        }

        clearReconnectTimer();

        socket = createStreamSocketFromUrl(streamInfo.wsUrl, {
          onOpen: () => {
            if (cancelled) {
              return;
            }
            reconnectAttempt = 0;
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
          },
          onMessage: (event) => {
            if (cancelled || connectEpoch !== connectEpochRef.current) {
              return;
            }

            if (typeof event.data === "string") {
              try {
                const message = JSON.parse(event.data);
                if (message.type === "hello") {
                  sessionIdRef.current = String(message.sessionId || "");
                  return;
                }

                if (message.type === "state") {
                  if (message.status === "ERROR") {
                    console.error("[H264Decoder] stream state error", { serial, message });
                    onFrameStateChangeRef.current?.("error");
                  }
                  return;
                }

                if (message.type === "error") {
                  console.error("[H264Decoder] stream protocol error", { serial, message });
                  onFrameStateChangeRef.current?.("error");
                  return;
                }

                if (message.type === "config") {
                  const incomingSessionId = String(message.sessionId || "");
                  if (sessionIdRef.current && incomingSessionId && incomingSessionId !== sessionIdRef.current) {
                    console.warn("[H264Decoder] ignoring config from unexpected session", {
                      serial,
                      expected: sessionIdRef.current,
                      got: incomingSessionId,
                    });
                    return;
                  }

                  if (incomingSessionId) {
                    sessionIdRef.current = incomingSessionId;
                  }

                  const codecConfig = base64ToUint8Array(message.codecConfig);
                  if (!codecConfig) {
                    console.warn("[H264Decoder] config received without codecConfig", {
                      serial,
                      message,
                    });
                    drawFallback("Waiting for codec config");
                    return;
                  }

                  const codec = normalizeCodec(message.codec, codecConfig);
                  const annexBConfig = convertAvcConfigToAnnexB(codecConfig);
                  if (!annexBConfig) {
                    console.warn("[H264Decoder] unable to normalize codec config", {
                      serial,
                      codec,
                      codecConfigBytes: codecConfig.byteLength,
                    });
                    drawFallback("Invalid codec config");
                    return;
                  }

                  const description = buildAvcDecoderDescription(codecConfig);
                  if (!description) {
                    console.warn("[H264Decoder] codec config missing SPS/PPS", {
                      serial,
                      codec,
                      codecConfigBytes: codecConfig.byteLength,
                    });
                  }

                  resetDecoderState();
                  codecConfigAnnexBRef.current = annexBConfig;
                  decoder = createDecoder(codec);
                  decoderRef.current = decoder;
                  hasConfigRef.current = Boolean(decoder);
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

            const frame = parseBinaryFrame(payload);
            if (!frame) {
              return;
            }

            const { data, isKeyFrame, timestampUs } = frame;

            if (!decoder || !hasConfigRef.current) {
              return;
            }

            if (!hasReceivedKeyFrameRef.current) {
              if (!isKeyFrame) {
                return;
              }

              hasReceivedKeyFrameRef.current = true;
            }

            if (decoder.state === "closed") {
              decoder = null;
              decoderRef.current = null;
              hasReceivedKeyFrameRef.current = false;
              hasLoggedFirstFrameRef.current = false;
              hasConfigRef.current = false;
              return;
            }

            if (decoder.decodeQueueSize > MAX_DECODE_QUEUE && !isKeyFrame) {
              return;
            }

            let chunkData = data;
            if (
              isKeyFrame
              && codecConfigAnnexBRef.current
              && codecConfigAnnexBRef.current.length > 0
              && !hasSpsOrPpsNalu(data)
            ) {
              chunkData = concatUint8Arrays(codecConfigAnnexBRef.current, data);
            }

            let safeTimestampUs = timestampUs;
            if (safeTimestampUs <= lastTimestampUsRef.current) {
              safeTimestampUs = lastTimestampUsRef.current + 1;
            }
            lastTimestampUsRef.current = safeTimestampUs;

            try {
              decoder.decode(
                new EncodedVideoChunk({
                  type: isKeyFrame ? "key" : "delta",
                  timestamp: safeTimestampUs,
                  data: chunkData,
                })
              );
            } catch (error) {
              console.error("[H264Decoder] decode failed", {
                serial,
                error,
                isKeyFrame,
                queueSize: decoder.decodeQueueSize,
              });
              resetDecoderState();
              onFrameStateChangeRef.current?.("error");
            }
          },
        });
      } catch (error) {
        connecting = false;
        if (!cancelled) {
          console.error("[H264Decoder] decoder setup failed", { serial, error });
          setConnectionState("error");
          scheduleReconnect();
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      if (connectEpochRef.current === connectEpoch) {
        connectEpochRef.current += 1;
      }
      clearReconnectTimer();
      onFrameStateChangeRef.current?.("idle");
      resetDecoderState();
      sessionIdRef.current = "";
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
