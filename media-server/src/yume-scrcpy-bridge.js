import { EventEmitter } from "node:events";
import { constants as fsConstants } from "node:fs";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import {
  AdbScrcpyClient,
  AdbScrcpyOptionsLatest,
} from "@yume-chan/adb-scrcpy";
import {
  AndroidKeyEventAction,
  AndroidMotionEventAction,
  AndroidMotionEventButton,
  ScrcpyVideoCodecId,
} from "@yume-chan/scrcpy";

import {
  MAIN_STREAM_FPS_MAX,
  MAIN_STREAM_FPS_MIN,
  DEFAULT_CODEC,
  SCRCPY_SERVER_DEVICE_PATH,
  SCRCPY_SERVER_SOURCE_PATH,
  SCRCPY_SERVER_VERSION,
  SCRCPY_VIDEO_ENCODER,
} from "./config.js";
import { createAdbContext } from "./yume-adb.js";

const LOCAL_SCRCPY_CACHE_DIR = path.resolve(process.cwd(), ".cache", "scrcpy");

const pushedServerBySerial = new Set();

function mapScrcpyCodec(codecId) {
  if (codecId === ScrcpyVideoCodecId.H264) {
    return DEFAULT_CODEC;
  }
  return DEFAULT_CODEC;
}

function clampFps(value) {
  const minFps = Math.max(1, Number(MAIN_STREAM_FPS_MIN) || 30);
  const maxFps = Math.max(minFps, Number(MAIN_STREAM_FPS_MAX) || 60);
  const requested = Number(value || maxFps);
  if (!Number.isFinite(requested)) {
    return maxFps;
  }
  return Math.max(minFps, Math.min(maxFps, requested));
}

async function canReadFile(filePath) {
  if (!filePath) {
    return false;
  }

  try {
    await access(filePath, fsConstants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

async function ensureScrcpyServerLocalPath() {
  if (await canReadFile(SCRCPY_SERVER_SOURCE_PATH)) {
    return SCRCPY_SERVER_SOURCE_PATH;
  }

  await mkdir(LOCAL_SCRCPY_CACHE_DIR, { recursive: true });
  const filename = `scrcpy-server-v${SCRCPY_SERVER_VERSION}`;
  const localPath = path.join(LOCAL_SCRCPY_CACHE_DIR, filename);

  if (await canReadFile(localPath)) {
    return localPath;
  }

  const downloadUrl = `https://github.com/Genymobile/scrcpy/releases/download/v${SCRCPY_SERVER_VERSION}/${filename}`;
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`download_scrcpy_server_failed:${response.status}`);
  }

  const payload = Buffer.from(await response.arrayBuffer());
  if (!payload.length) {
    throw new Error("download_scrcpy_server_empty");
  }

  await writeFile(localPath, payload);
  return localPath;
}

async function pushScrcpyServer(adb, serial) {
  if (pushedServerBySerial.has(serial)) {
    return;
  }

  const localPath = await ensureScrcpyServerLocalPath();
  const content = await readFile(localPath);
  const stream = Readable.toWeb(Readable.from(content));
  await AdbScrcpyClient.pushServer(adb, stream, SCRCPY_SERVER_DEVICE_PATH);
  pushedServerBySerial.add(serial);
}

export class YumeScrcpyBridge extends EventEmitter {
  constructor(serial, streamProfile) {
    super();
    this.serial = serial;
    this.streamProfile = streamProfile;
    this.adbContext = null;
    this.scrcpyClient = null;
    this.controller = null;
    this.videoReader = null;
    this.outputReader = null;
    this.outputPump = null;
    this.videoPump = null;
    this.sizeChangedDisposer = null;
    this.videoCodec = "h264";
    this.codecConfigAnnexB = null;
    this.deviceSize = { width: 1080, height: 1920 };
    this.closed = false;
  }

  async start() {
    this.emit("log", {
      stage: "ADB_CONNECT",
      serial: this.serial,
      message: "Connecting through AdbServerClient",
    });

    this.adbContext = await createAdbContext(this.serial);

    await pushScrcpyServer(this.adbContext.adb, this.serial);

    const fps = clampFps(this.streamProfile?.fps);
    const bitrate = Number(this.streamProfile?.bitrate || 2_000_000);

    const options = new AdbScrcpyOptionsLatest(
      {
        video: true,
        audio: false,
        control: true,
        cleanup: true,
        tunnelForward: false,
        videoCodec: "h264",
        videoEncoder: SCRCPY_VIDEO_ENCODER,
        videoBitRate: bitrate,
        maxFps: fps,
        sendFrameMeta: true,
        sendCodecMeta: true,
      },
      {
        version: SCRCPY_SERVER_VERSION,
      }
    );

    this.scrcpyClient = await AdbScrcpyClient.start(
      this.adbContext.adb,
      SCRCPY_SERVER_DEVICE_PATH,
      options
    );

    this.controller = this.scrcpyClient.controller;

    this.outputPump = this.consumeOutput();

    const video = await this.scrcpyClient.videoStream;
    if (!video) {
      throw new Error("scrcpy_video_stream_unavailable");
    }

    const width = Number(video.metadata?.width || video.width || this.deviceSize.width || 1080);
    const height = Number(video.metadata?.height || video.height || this.deviceSize.height || 1920);
    this.deviceSize = { width, height };
    const codec = mapScrcpyCodec(video.metadata?.codec);
    this.videoCodec = codec;

    this.emit("config", {
      type: "config",
      codec,
      width,
      height,
    });

    this.sizeChangedDisposer = video.sizeChanged?.((size) => {
      const nextWidth = Number(size?.width || this.deviceSize.width || 1080);
      const nextHeight = Number(size?.height || this.deviceSize.height || 1920);
      this.deviceSize = {
        width: nextWidth,
        height: nextHeight,
      };

      this.emit("config", {
        type: "config",
        codec: this.videoCodec,
        width: nextWidth,
        height: nextHeight,
      });
    });

    this.videoReader = video.stream.getReader();
    this.videoPump = this.consumeVideoPackets();

    this.emit("log", {
      stage: "SERVER_PUSH",
      serial: this.serial,
      message: "scrcpy native client started",
    });

    this.emit("log", {
      stage: "STREAM_START",
      serial: this.serial,
      message: `Native H264 stream active (fps=${fps}, bitrate=${bitrate}, encoder=${SCRCPY_VIDEO_ENCODER})`,
    });
  }

  async consumeOutput() {
    if (!this.scrcpyClient?.output) {
      return;
    }

    this.outputReader = this.scrcpyClient.output.getReader();

    try {
      while (!this.closed) {
        const { done, value } = await this.outputReader.read();
        if (done) {
          break;
        }

        const line = String(value || "").trim();
        if (!line) {
          continue;
        }

        this.emit("log", {
          stage: "SCRCPY",
          serial: this.serial,
          message: line,
        });
      }
    } catch (error) {
      if (!this.closed) {
        this.emit("error", error);
      }
    }
  }

  async consumeVideoPackets() {
    if (!this.videoReader) {
      return;
    }

    try {
      while (!this.closed) {
        const { done, value } = await this.videoReader.read();
        if (done) {
          break;
        }

        if (!value) {
          continue;
        }

        const packet = value;
        const payload = Buffer.from(packet.data || []);
        if (!payload.length) {
          continue;
        }

        if (packet.type === "configuration") {
          this.codecConfigAnnexB = payload;
          continue;
        }

        const isKeyFrame = Boolean(packet.keyframe);
        let normalizedPayload = payload;

        if (isKeyFrame && this.codecConfigAnnexB?.length) {
          normalizedPayload = Buffer.concat([this.codecConfigAnnexB, payload]);
        }

        this.emit("frame", normalizedPayload, {
          isKeyFrame,
          isConfig: false,
        });
      }

      if (!this.closed) {
        this.emit("close");
      }
    } catch (error) {
      if (!this.closed) {
        this.emit("error", error);
      }
    }
  }

  async injectTouch(action, normalizedX, normalizedY) {
    if (!this.controller) {
      return;
    }

    const x = Math.max(0, Math.min(1, Number(normalizedX || 0))) * this.deviceSize.width;
    const y = Math.max(0, Math.min(1, Number(normalizedY || 0))) * this.deviceSize.height;
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    const command = String(action || "").toLowerCase();

    const sendTouch = async (motionAction, pressure, buttons) => {
      await this.controller.injectTouch({
        action: motionAction,
        pointerId: 0n,
        pointerX: roundedX,
        pointerY: roundedY,
        pressure,
        actionButton: AndroidMotionEventButton.Primary,
        buttons,
        videoWidth: this.deviceSize.width,
        videoHeight: this.deviceSize.height,
      });
    };

    if (command === "move" || command === "mousemove") {
      await sendTouch(AndroidMotionEventAction.Move, 1, AndroidMotionEventButton.Primary);
      return;
    }

    if (command === "down" || command === "mousedown") {
      await sendTouch(AndroidMotionEventAction.Down, 1, AndroidMotionEventButton.Primary);
      return;
    }

    if (command === "up" || command === "mouseup") {
      await sendTouch(AndroidMotionEventAction.Up, 0, AndroidMotionEventButton.None);
      return;
    }

    if (command === "click") {
      await sendTouch(AndroidMotionEventAction.Down, 1, AndroidMotionEventButton.Primary);
      await sendTouch(AndroidMotionEventAction.Up, 0, AndroidMotionEventButton.None);
    }
  }

  async injectKeyCode(keyCode, action = 0) {
    if (!this.controller) {
      return;
    }

    await this.controller.injectKeyCode({
      action: action === 0 ? AndroidKeyEventAction.Down : AndroidKeyEventAction.Up,
      keyCode,
      repeat: 0,
      metaState: 0,
    });
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;

    this.sizeChangedDisposer?.dispose?.();
    this.sizeChangedDisposer = null;

    await this.videoReader?.cancel().catch(() => {});
    this.videoReader = null;

    await this.outputReader?.cancel().catch(() => {});
    this.outputReader = null;

    if (this.controller) {
      await this.controller.close().catch(() => {});
      this.controller = null;
    }

    if (this.scrcpyClient) {
      await this.scrcpyClient.close().catch(() => {});
      this.scrcpyClient = null;
    }

    if (this.adbContext) {
      await this.adbContext.close();
      this.adbContext = null;
    }
  }

  async destroy() {
    await this.close();
  }
}
