export function clamp01(value) {
  if (Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

export function normalizeFramePayload(frameBuffer, isKeyFrame) {
  const frame = Buffer.isBuffer(frameBuffer)
    ? frameBuffer
    : Buffer.from(frameBuffer instanceof Uint8Array ? frameBuffer : frameBuffer?.data || []);
  const flag = Buffer.from([isKeyFrame ? 1 : 0]);
  return Buffer.concat([flag, frame]);
}

export async function safeCall(fn) {
  try {
    return await fn();
  } catch (error) {
    return undefined;
  }
}
