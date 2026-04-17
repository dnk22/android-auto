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
    const sessionBySerial = new Map();

    for (const session of this.sessions.values()) {
      const current = sessionBySerial.get(session.serial);
      if (!current) {
        sessionBySerial.set(session.serial, session);
        continue;
      }

      // Prefer main stream session for controls, fallback to any available session.
      if (current.type !== "main" && session.type === "main") {
        sessionBySerial.set(session.serial, session);
      }
    }

    const targets = [];
    for (const session of sessionBySerial.values()) {
      targets.push(
        session.handleControl({
          ...payload,
          target: "selected",
        })
      );
    }

    await Promise.allSettled(targets);
  }

  log(message) {
    this.logRelay?.log(message);
  }
}
