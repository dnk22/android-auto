import { EventEmitter } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { DEFAULT_CODEC } from "./config.js";

const execFileAsync = promisify(execFile);

export class ScreenCaptureBridge extends EventEmitter {
  constructor(serial, streamProfile, deviceSize) {
    super();
    this.serial = serial;
    this.streamProfile = streamProfile;
    this.deviceSize = deviceSize;
    this.running = false;
    this.timer = null;
    this.firstFrameSent = false;
    this.intervalMs = streamProfile?.fps ? Math.max(100, Math.round(1000 / streamProfile.fps)) : 250;
  }

  async start() {
    if (this.running) {
      return this;
    }

    this.running = true;
    this.emit("config", {
      codec: "png",
      width: this.deviceSize.width,
      height: this.deviceSize.height,
      description: undefined,
      fallback: true,
      source: DEFAULT_CODEC,
    });

    const loop = async () => {
      if (!this.running) {
        return;
      }

      try {
        const { stdout } = await execFileAsync("adb", ["-s", this.serial, "exec-out", "screencap", "-p"], {
          encoding: null,
          maxBuffer: 20 * 1024 * 1024,
        });

        if (!this.running) {
          return;
        }

        const frame = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
        if (frame.length > 0) {
          this.firstFrameSent = true;
          this.emit("frame", frame, true);
        }
      } catch (error) {
        this.emit("error", error);
      }

      if (this.running) {
        this.timer = setTimeout(loop, this.intervalMs);
      }
    };

    void loop();
    return this;
  }

  async close() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.emit("close");
  }

  async destroy() {
    await this.close();
  }
}
