import { WebSocket } from "ws";

import { clamp01, safeCall } from "./frame.js";
import { YumeScrcpyBridge } from "./yume-scrcpy-bridge.js";

const KEY_CODE_BY_ACTION = {
  back: 4,
  home: 3,
  recents: 187,
};

export class StreamSession {
  constructor(serial, type, profile, manager) {
    this.serial = serial;
    this.type = type;
    this.profile = profile;
    this.manager = manager;
    this.clients = new Set();
    this.bridge = null;
    this.bridgeStarted = false;
    this.bridgeConfig = null;
    this.deviceSize = { width: 0, height: 0 };
    this.lastFrameAt = 0;
    this.cleanupTimer = null;
    this.headerFrames = [];
    this.lastKeyFrame = null;
    this.isStopping = false;
  }

  async attach(websocket) {
    this.clients.add(websocket);
    await this.startBridge();

    if (this.bridgeConfig) {
      this.sendConfigToClient(websocket, this.bridgeConfig);
    }

    for (const frame of this.headerFrames) {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(frame);
      }
    }

    if (this.lastKeyFrame && websocket.readyState === WebSocket.OPEN) {
      websocket.send(this.lastKeyFrame);
    }

    this.cancelCleanup();
  }

  async detach(websocket) {
    this.clients.delete(websocket);
    if (!this.isStopping && this.clients.size === 0) {
      this.scheduleCleanup();
    }
  }

  scheduleCleanup() {
    this.cancelCleanup();
    this.cleanupTimer = setTimeout(() => {
      this.stop().catch(() => {});
    }, 5_000);
  }

  cancelCleanup() {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async startBridge() {
    if (this.bridgeStarted) {
      return;
    }

    this.bridgeStarted = true;
    const bridge = new YumeScrcpyBridge(this.serial, this.profile);
    await this.attachBridge(bridge);
  }

  async attachBridge(bridge) {
    this.bridge = bridge;

    this.bridge.on("config", (config) => {
      this.bridgeConfig = config;
      this.deviceSize = {
        width: Number(config?.width || this.deviceSize.width || 1080),
        height: Number(config?.height || this.deviceSize.height || 1920),
      };
      for (const client of this.clients) {
        this.sendConfigToClient(client, config);
      }
    });

    this.bridge.on("frame", (frameBuffer, isKeyFrame) => {
      this.forwardFrame(frameBuffer, isKeyFrame);
    });

    this.bridge.on("log", (payload) => {
      this.broadcastJson({
        type: "stream_log",
        data: payload,
      });
    });

    this.bridge.on("close", () => {
      this.broadcastJson({
        type: "stream_closed",
        data: {
          serial: this.serial,
          type: this.type,
        },
      });
      this.stop().catch(() => {});
    });

    this.bridge.on("error", (error) => {
      this.broadcastJson({
        type: "stream_error",
        data: {
          serial: this.serial,
          type: this.type,
          message: error?.message || String(error),
        },
      });
    });

    if (typeof this.bridge.start === "function") {
      await this.bridge.start();
    }
  }

  async stop() {
    this.cancelCleanup();
    this.isStopping = true;

    if (this.bridge && typeof this.bridge.close === "function") {
      await safeCall(() => this.bridge.close());
    }

    if (this.bridge && typeof this.bridge.destroy === "function") {
      await safeCall(() => this.bridge.destroy());
    }

    this.bridge = null;
    this.bridgeStarted = false;
    this.headerFrames = [];
    this.lastKeyFrame = null;

    for (const client of this.clients) {
      safeCall(() => client.close());
    }

    this.clients.clear();
    this.isStopping = false;
  }

  sendConfigToClient(client, config) {
    if (client.readyState !== WebSocket.OPEN) {
      return;
    }

    client.send(JSON.stringify({ type: "config", ...config }));
  }

  broadcastJson(payload) {
    const text = JSON.stringify(payload);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(text);
      }
    }
  }

  forwardFrame(frameBuffer, isKeyFrame) {
    const now = Date.now();
    const minInterval = this.type === "thumb" ? 100 : 0;
    if (this.type === "thumb" && now - this.lastFrameAt < minInterval) {
      return;
    }

    this.lastFrameAt = now;
    const payload = Buffer.isBuffer(frameBuffer)
      ? frameBuffer
      : Buffer.from(frameBuffer instanceof Uint8Array ? frameBuffer : frameBuffer?.data || []);

    if (isKeyFrame) {
      this.lastKeyFrame = payload;
      this.headerFrames = [payload].slice(-2);
    }

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  async handleMessage(payload) {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const messageType = String(payload.type || "").toLowerCase();
    const normalizedPayload =
      messageType === "control"
        ? payload
        : {
            ...payload,
            type: "control",
            action: messageType || payload.action,
          };

    if (normalizedPayload.type !== "control") {
      return;
    }

    if (normalizedPayload.target === "all") {
      await this.manager.broadcastControl(normalizedPayload);
      return;
    }

    await this.handleControl(normalizedPayload);
  }

  async handleControl(payload) {
    const action = String(payload.action || "").toLowerCase();
    if (!action) {
      return;
    }

    if (KEY_CODE_BY_ACTION[action]) {
      await this.bridge.injectKeyCode(KEY_CODE_BY_ACTION[action], 0);
      await this.bridge.injectKeyCode(KEY_CODE_BY_ACTION[action], 1);
      return;
    }

    const x = clamp01(Number(payload.x ?? 0.5));
    const y = clamp01(Number(payload.y ?? 0.5));
    await this.bridge.injectTouch(action, x, y, Number(payload.pointerId || 0));
  }
}
