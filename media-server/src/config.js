export const MEDIA_SERVER_PORT = Number(process.env.PORT || 3001);
export const ADB_SERVER_HOST = process.env.ADB_SERVER_HOST || "127.0.0.1";
export const ADB_SERVER_PORT = Number(process.env.ADB_SERVER_PORT || 5037);

export const DEFAULT_CODEC = "avc1.42E01E";

export const STREAM_PROFILES = {
  thumb: {
    bitrate: 200_000,
    fps: 10,
    scale: 0.2,
  },
  main: {
    bitrate: 2_000_000,
    fps: 30,
    scale: 1,
  },
};

export const PROFILE_ALIASES = {
  thumb: "thumb",
  thumbnail: "thumb",
  main: "main",
  detail: "main",
};
