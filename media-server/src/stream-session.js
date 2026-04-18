import { WebSocket } from "ws";

import { clamp01, safeCall } from "./frame.js";
import { YumeScrcpyBridge } from "./yume-scrcpy-bridge.js";

const KEY_CODE_BY_ACTION = {
  back: 4,
  home: 3,
  recents: 187,
};

export class StreamSession {
  constructor(serial, streamProfile, manager) {
    this.serial = serial;
    this.streamProfile = streamProfile;
    this.manager = manager;
    this.clients = new Set();
    this.bridge = null;
    this.bridgeStarted = false;
    this.bridgeConfig = null;
    this.deviceSize = { width: 0, height: 0 };
    this.cleanupTimer = null;
    this.lastKeyFrame = null;
    this.latestFrame = null;
    this.isStopping = false;
    this.stats = {
      startedAt: Date.now(),
      lastFrameAt: null,
      lastConfigAt: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      framesReceived: 0,
      keyFramesReceived: 0,
      bytesReceived: 0,
      framesBroadcast: 0,
      broadcastSamples: 0,
      broadcastLatencyMsTotal: 0,
      maxBroadcastLatencyMs: 0,
      maxBufferedAmountBytes: 0,
      slowClients: 0,
    };
  }

  async attach(websocket) {
    this.clients.add(websocket);
    await this.startBridge();

    if (this.bridgeConfig) {
      this.sendConfigToClient(websocket, this.bridgeConfig);
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
    const bridge = new YumeScrcpyBridge(this.serial, this.streamProfile);
    await this.attachBridge(bridge);
  }

  async attachBridge(bridge) {
    this.bridge = bridge;

    this.bridge.on("config", (config) => {
      this.bridgeConfig = config;
      this.stats.lastConfigAt = Date.now();
      this.deviceSize = {
        width: Number(config?.width || this.deviceSize.width || 1080),
        height: Number(config?.height || this.deviceSize.height || 1920),
      };
      for (const client of this.clients) {
        this.sendConfigToClient(client, config);
      }
    });

    this.bridge.on("frame", (frameBuffer, frameMeta) => {
      this.forwardFrame(frameBuffer, frameMeta);
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
        },
      });
      this.stop().catch(() => {});
    });

    this.bridge.on("error", (error) => {
      this.stats.lastErrorAt = Date.now();
      this.stats.lastErrorMessage = error?.message || String(error);
      this.broadcastJson({
        type: "stream_error",
        data: {
          serial: this.serial,
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
    this.lastKeyFrame = null;
    this.latestFrame = null;

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

  forwardFrame(frameBuffer, frameMeta = {}) {
    const rawPayload = Buffer.isBuffer(frameBuffer)
      ? frameBuffer
      : Buffer.from(frameBuffer instanceof Uint8Array ? frameBuffer : frameBuffer?.data || []);

    if (!rawPayload.length) {
      return;
    }

    const isKeyFrame = Boolean(frameMeta?.isKeyFrame);
    const start = process.hrtime.bigint();

    const payload = Buffer.concat([Buffer.from([isKeyFrame ? 1 : 0]), rawPayload]);

    this.latestFrame = payload;
    this.stats.framesReceived += 1;
    this.stats.bytesReceived += payload.length;
    this.stats.lastFrameAt = Date.now();

    if (isKeyFrame) {
      this.lastKeyFrame = payload;
      this.stats.keyFramesReceived += 1;
    }

    let maxBufferedAmount = 0;
    let slowClients = 0;
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        const bufferedAmount = Number(client.bufferedAmount || 0);
        if (bufferedAmount > maxBufferedAmount) {
          maxBufferedAmount = bufferedAmount;
        }
        if (bufferedAmount > 1_000_000) {
          slowClients += 1;
        }
      }
    }

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    this.stats.framesBroadcast += 1;
    this.stats.broadcastSamples += 1;
    this.stats.broadcastLatencyMsTotal += elapsedMs;
    this.stats.maxBroadcastLatencyMs = Math.max(this.stats.maxBroadcastLatencyMs, elapsedMs);
    this.stats.maxBufferedAmountBytes = Math.max(this.stats.maxBufferedAmountBytes, maxBufferedAmount);
    this.stats.slowClients = slowClients;
  }

  getLatestFrame() {
    if (!this.latestFrame) {
      return null;
    }
    return Buffer.from(this.latestFrame);
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

  getStatsSnapshot() {
    const avgBroadcastLatencyMs =
      this.stats.broadcastSamples > 0
        ? this.stats.broadcastLatencyMsTotal / this.stats.broadcastSamples
        : 0;

    return {
      serial: this.serial,
      activeClients: this.clients.size,
      bridgeStarted: this.bridgeStarted,
      deviceSize: this.deviceSize,
      codec: this.bridgeConfig?.codec || null,
      startedAt: this.stats.startedAt,
      lastFrameAt: this.stats.lastFrameAt,
      lastConfigAt: this.stats.lastConfigAt,
      lastErrorAt: this.stats.lastErrorAt,
      lastErrorMessage: this.stats.lastErrorMessage,
      framesReceived: this.stats.framesReceived,
      keyFramesReceived: this.stats.keyFramesReceived,
      bytesReceived: this.stats.bytesReceived,
      framesBroadcast: this.stats.framesBroadcast,
      averageBroadcastLatencyMs: Number(avgBroadcastLatencyMs.toFixed(3)),
      maxBroadcastLatencyMs: Number(this.stats.maxBroadcastLatencyMs.toFixed(3)),
      maxWsBufferedAmountBytes: this.stats.maxBufferedAmountBytes,
      slowClients: this.stats.slowClients,
    };
  }
}
