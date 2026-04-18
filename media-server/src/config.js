export const MEDIA_SERVER_PORT = Number(process.env.PORT || 3001);
export const ADB_SERVER_HOST = process.env.ADB_SERVER_HOST || "127.0.0.1";
export const ADB_SERVER_PORT = Number(process.env.ADB_SERVER_PORT || 5037);

export const DEFAULT_CODEC = "avc1.42E01E";

export const THUMB_COMPRESS_WIDTH = Number(process.env.THUMB_COMPRESS_WIDTH || 240);
export const THUMB_COMPRESS_WEBP_QUALITY = Number(process.env.THUMB_COMPRESS_WEBP_QUALITY || 40);
export const THUMB_COMPRESS_WEBP_EFFORT = Number(process.env.THUMB_COMPRESS_WEBP_EFFORT || 6);

export const STREAM_PROFILES = {
  thumb: {
    bitrate: 200_000,
    fps: 5,
    scale: 0.2,
  },
  main: {
    bitrate: 2_000_000,
    fps: 60,
    scale: 1,
  },
};

export const PROFILE_ALIASES = {
  thumb: "thumb",
  thumbnail: "thumb",
  main: "main",
  detail: "main",
};
