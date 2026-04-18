import sharp from "sharp";

import {
  ADB_SERVER_HOST,
  ADB_SERVER_PORT,
  THUMB_COMPRESS_WEBP_EFFORT,
  THUMB_COMPRESS_WEBP_QUALITY,
  THUMB_COMPRESS_WIDTH,
} from "./config.js";

export async function createAdbContext(serial) {
  const adbModule = await import("@yume-chan/adb");
  const tcpModule = await import("@yume-chan/adb-server-node-tcp");

  const AdbServerClient = adbModule.AdbServerClient || tcpModule.AdbServerClient;
  const AdbServerNodeTcpConnector = tcpModule.AdbServerNodeTcpConnector;

  if (!AdbServerClient || !AdbServerNodeTcpConnector) {
    throw new Error("Required yume-chan ADB classes are not available");
  }

  const connector = new AdbServerNodeTcpConnector({
    host: ADB_SERVER_HOST,
    port: ADB_SERVER_PORT,
  });
  const server = new AdbServerClient(connector);
  const adb = await server.createAdb({ serial });

  const close = async () => {
    await adb.close();
  };

  return {
    adb,
    server,
    close,
  };
}

export async function captureThumbFrame(serial) {
  const adbContext = await createAdbContext(serial);

  try {
    const shellProtocol = adbContext.adb.subprocess.shellProtocol;
    let frameBytes;

    if (shellProtocol?.isSupported) {
      const result = await shellProtocol.spawnWait(["screencap", "-p"]);
      if (result.exitCode !== 0) {
        const stderr = Buffer.from(result.stderr || []).toString("utf8").trim();
        throw new Error(stderr || `screencap exited with code ${result.exitCode}`);
      }
      frameBytes = result.stdout;
    } else {
      frameBytes = await adbContext.adb.subprocess.noneProtocol.spawnWait(["screencap", "-p"]);
    }

    const png = Buffer.from(frameBytes || []);
    if (png.length === 0) {
      throw new Error("empty screenshot payload");
    }

    return compressThumbImageToWebp(png);
  } finally {
    await adbContext.close();
  }
}

async function compressThumbImageToWebp(pngBuffer) {
  const targetWidth = Number.isFinite(THUMB_COMPRESS_WIDTH)
    ? Math.max(80, Math.min(THUMB_COMPRESS_WIDTH, 720))
    : 240;
  const targetQuality = Number.isFinite(THUMB_COMPRESS_WEBP_QUALITY)
    ? Math.max(20, Math.min(THUMB_COMPRESS_WEBP_QUALITY, 100))
    : 55;
  const targetEffort = Number.isFinite(THUMB_COMPRESS_WEBP_EFFORT)
    ? Math.max(0, Math.min(THUMB_COMPRESS_WEBP_EFFORT, 6))
    : 6;

  return sharp(pngBuffer)
    .resize({
      width: targetWidth,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      effort: targetEffort,
      quality: targetQuality,
      smartSubsample: true,
      alphaQuality: targetQuality,
    })
    .toBuffer();
}
