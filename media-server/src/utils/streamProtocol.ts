const KEYFRAME_FLAG = 0x01;
const DELTA_FLAG = 0x00;

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

export const wrapFrame = (frame: Buffer, keyframeHint?: boolean): Buffer => {
  const isFrameKey = keyframeHint ?? isKeyframe(frame);
  const flag = isFrameKey ? KEYFRAME_FLAG : DELTA_FLAG;
  return Buffer.concat([Buffer.from([flag]), frame]);
};

export interface StreamConfigMessage {
  type: "config";
  codec: "h264";
  width: number;
  height: number;
}

export const buildConfigMessage = (width: number, height: number): StreamConfigMessage => ({
  type: "config",
  codec: "h264",
  width,
  height,
});
