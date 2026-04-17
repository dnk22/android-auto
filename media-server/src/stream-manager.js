import { STREAM_PROFILES } from "./config.js";
import { StreamSession } from "./stream-session.js";

export class StreamManager {
  constructor(logRelay) {
    this.sessions = new Map();
    this.logRelay = logRelay;
  }

  sessionKey(serial, type) {
    return `${serial}:${type}`;
  }

  async getSession(serial, type) {
    const key = this.sessionKey(serial, type);
    if (!this.sessions.has(key)) {
      this.sessions.set(key, new StreamSession(serial, type, STREAM_PROFILES[type], this, this.logRelay));
    }

    return this.sessions.get(key);
  }

  async broadcastControl(payload) {
    const targets = [];
    for (const session of this.sessions.values()) {
      if (session.type === "main") {
        targets.push(
          session.handleControl({
            ...payload,
            target: "selected",
          })
        );
      }
    }
    await Promise.allSettled(targets);
  }

  log(message) {
    this.logRelay?.log(message);
  }
}
