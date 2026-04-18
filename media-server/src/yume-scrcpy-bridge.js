import { EventEmitter } from "node:events";

import { ScreenCaptureBridge } from "./screen-capture-bridge.js";
import { createAdbContext } from "./yume-adb.js";

export class YumeScrcpyBridge extends EventEmitter {
  constructor(serial, streamProfile) {
    super();
    this.serial = serial;
    this.streamProfile = streamProfile;
    this.adbContext = null;
    this.frameSource = null;
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

    this.emit("log", {
      stage: "SERVER_PUSH",
      serial: this.serial,
      message: "scrcpy client runtime is not exposed in installed package; using ADB-backed frame fallback",
    });

    this.frameSource = new ScreenCaptureBridge(this.serial, this.streamProfile, this.deviceSize);

    this.frameSource.on("config", (config) => {
      this.deviceSize = {
        width: Number(config?.width || this.deviceSize.width || 1080),
        height: Number(config?.height || this.deviceSize.height || 1920),
      };

      const codec = String(config?.codec || "").toLowerCase() || "png";

      this.emit("config", {
        type: "config",
        codec,
        width: this.deviceSize.width,
        height: this.deviceSize.height,
        description: config?.description,
      });
    });

    this.frameSource.on("frame", (frameBuffer, isKeyFrame) => {
      this.emit("frame", frameBuffer, isKeyFrame);
    });

    this.frameSource.on("error", (error) => {
      this.emit("error", error);
    });

    this.frameSource.on("close", () => {
      this.emit("close");
    });

    this.emit("log", {
      stage: "STREAM_START",
      serial: this.serial,
      message: "Fallback screen capture stream started",
    });

    await this.frameSource.start();
  }

  async injectTouch(action, normalizedX, normalizedY) {
    const x = Math.max(0, Math.min(1, Number(normalizedX || 0))) * this.deviceSize.width;
    const y = Math.max(0, Math.min(1, Number(normalizedY || 0))) * this.deviceSize.height;
    const roundedX = Math.round(x);
    const roundedY = Math.round(y);
    const command = String(action || "").toLowerCase();

    if (command === "move" || command === "mousemove") {
      return;
    }

    if (command === "down" || command === "mousedown" || command === "up" || command === "mouseup" || command === "click") {
      await this.adbContext.adb.createSocketAndWait(`shell,v2,raw:input tap ${roundedX} ${roundedY}`);
    }
  }

  async injectKeyCode(keyCode, action = 0) {
    if (action !== 0) {
      return;
    }

    await this.adbContext.adb.createSocketAndWait(`shell,v2,raw:input keyevent ${keyCode}`);
  }

  async close() {
    if (this.closed) {
      return;
    }
    this.closed = true;

    if (this.frameSource) {
      await this.frameSource.close();
      this.frameSource = null;
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
