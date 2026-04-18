export const MEDIA_SERVER_PORT = Number(process.env.PORT || 3001);
export const ADB_SERVER_HOST = process.env.ADB_SERVER_HOST || "127.0.0.1";
export const ADB_SERVER_PORT = Number(process.env.ADB_SERVER_PORT || 5037);

export const DEFAULT_CODEC = "avc1.42E01E";

export const SCRCPY_SERVER_VERSION = process.env.SCRCPY_SERVER_VERSION || "3.3.3";
export const SCRCPY_SERVER_DEVICE_PATH =
  process.env.SCRCPY_SERVER_DEVICE_PATH || "/data/local/tmp/scrcpy-server.jar";
export const SCRCPY_SERVER_SOURCE_PATH = process.env.SCRCPY_SERVER_SOURCE_PATH || "";
export const SCRCPY_VIDEO_ENCODER =
  process.env.SCRCPY_VIDEO_ENCODER || "OMX.google.h264.encoder";

export const THUMB_COMPRESS_WIDTH = Number(process.env.THUMB_COMPRESS_WIDTH || 240);
export const THUMB_COMPRESS_WEBP_QUALITY = Number(process.env.THUMB_COMPRESS_WEBP_QUALITY || 40);
export const THUMB_COMPRESS_WEBP_EFFORT = Number(process.env.THUMB_COMPRESS_WEBP_EFFORT || 6);

export const MAIN_STREAM_PROFILE = {
  bitrate: 2_000_000,
  fps: 60,
  scale: 1,
};

export const MAIN_STREAM_FPS_MIN = Number(process.env.MAIN_STREAM_FPS_MIN || 30);
export const MAIN_STREAM_FPS_MAX = Number(process.env.MAIN_STREAM_FPS_MAX || 60);
