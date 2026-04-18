const KEYFRAME_FLAG = 0x01;
const DELTA_FLAG = 0x00;
const DEFAULT_CODEC = "avc1.42E01E";
const PROTOCOL_VERSION = 1;

interface NaluRange {
  payloadStart: number;
  nextStart: number;
}

const findStartCode = (buffer: Buffer, from: number): { offset: number; size: number } | null => {
  for (let index = Math.max(0, from); index <= buffer.length - 4; index += 1) {
    if (buffer[index] === 0x00 && buffer[index + 1] === 0x00) {
      if (buffer[index + 2] === 0x01) {
        return { offset: index, size: 3 };
      }

      if (buffer[index + 2] === 0x00 && buffer[index + 3] === 0x01) {
        return { offset: index, size: 4 };
      }
    }
  }

  return null;
};

const findNextNalu = (buffer: Buffer, from: number): NaluRange | null => {
  const start = findStartCode(buffer, from);
  if (!start) {
    return null;
  }

  const payloadStart = start.offset + start.size;
  if (payloadStart >= buffer.length) {
    return null;
  }

  const next = findStartCode(buffer, payloadStart);
  return {
    payloadStart,
    nextStart: next?.offset ?? buffer.length,
  };
};

const toAvcCodecString = (profileIdc: number, constraints: number, levelIdc: number): string =>
  `avc1.${profileIdc.toString(16).padStart(2, "0")}${constraints
    .toString(16)
    .padStart(2, "0")}${levelIdc.toString(16).padStart(2, "0")}`;

export const deriveAvcCodecString = (codecConfig?: Buffer): string => {
  if (!codecConfig || codecConfig.length < 4) {
    return DEFAULT_CODEC;
  }

  if (codecConfig[0] === 0x01 && codecConfig.length >= 4) {
    return toAvcCodecString(codecConfig[1], codecConfig[2], codecConfig[3]);
  }

  let cursor = 0;
  while (cursor < codecConfig.length) {
    const nalu = findNextNalu(codecConfig, cursor);
    if (!nalu) {
      break;
    }

    const header = codecConfig[nalu.payloadStart];
    const nalType = header & 0x1f;
    if (nalType === 7 && nalu.payloadStart + 3 < codecConfig.length) {
      return toAvcCodecString(
        codecConfig[nalu.payloadStart + 1],
        codecConfig[nalu.payloadStart + 2],
        codecConfig[nalu.payloadStart + 3],
      );
    }

    cursor = nalu.nextStart;
  }

  return DEFAULT_CODEC;
};

export const isKeyframe = (frame: Buffer): boolean => {
  let cursor = 0;

  while (cursor < frame.length) {
    const nalu = findNextNalu(frame, cursor);
    if (!nalu) {
      break;
    }

    const header = frame[nalu.payloadStart];
    const nalType = header & 0x1f;
    if (nalType === 5) {
      return true;
    }

    cursor = nalu.nextStart;
  }

  return false;
};

export const wrapFrame = (frame: Buffer, keyframeHint?: boolean, timestampMs?: number): Buffer => {
  const isFrameKey = keyframeHint ?? isKeyframe(frame);
  const flag = isFrameKey ? KEYFRAME_FLAG : DELTA_FLAG;
  const timestamp = Math.max(0, Math.trunc(timestampMs ?? Date.now()));
  const packet = Buffer.allocUnsafe(1 + 8 + frame.length);
  packet[0] = flag;
  packet.writeBigUInt64BE(BigInt(timestamp), 1);
  frame.copy(packet, 9);
  return packet;
};

export interface StreamHelloMessage {
  type: "hello";
  protocolVersion: number;
  sessionId: string;
  deviceId: string;
}

export const buildHelloMessage = (sessionId: string, deviceId: string): StreamHelloMessage => ({
  type: "hello",
  protocolVersion: PROTOCOL_VERSION,
  sessionId,
  deviceId,
});

export interface StreamConfigMessage {
  type: "config";
  sessionId: string;
  deviceId: string;
  codec: string;
  width: number;
  height: number;
  codecConfig?: string;
}

export const buildConfigMessage = (
  sessionId: string,
  deviceId: string,
  width: number,
  height: number,
  codecConfig?: Buffer,
  codec?: string,
): StreamConfigMessage => ({
  type: "config",
  sessionId,
  deviceId,
  codec: codec ?? deriveAvcCodecString(codecConfig),
  width,
  height,
  codecConfig: codecConfig && codecConfig.length > 0 ? codecConfig.toString("base64") : undefined,
});

export interface StreamStateMessage {
  type: "state";
  sessionId: string;
  deviceId: string;
  status: "STARTING" | "RUNNING" | "STOPPED" | "ERROR";
  timestampMs: number;
}

export const buildStateMessage = (
  sessionId: string,
  deviceId: string,
  status: "STARTING" | "RUNNING" | "STOPPED" | "ERROR",
  timestampMs?: number,
): StreamStateMessage => ({
  type: "state",
  sessionId,
  deviceId,
  status,
  timestampMs: Math.max(0, Math.trunc(timestampMs ?? Date.now())),
});

export interface StreamErrorMessage {
  type: "error";
  sessionId: string;
  deviceId: string;
  code: string;
  message: string;
  timestampMs: number;
}

export const buildErrorMessage = (
  sessionId: string,
  deviceId: string,
  code: string,
  message: string,
  timestampMs?: number,
): StreamErrorMessage => ({
  type: "error",
  sessionId,
  deviceId,
  code,
  message,
  timestampMs: Math.max(0, Math.trunc(timestampMs ?? Date.now())),
});
