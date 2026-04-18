import { MAIN_STREAM_PROFILE } from "./config.js";
import { StreamSession } from "./stream-session.js";

export class StreamManager {
  constructor(logRelay) {
    this.sessions = new Map();
    this.logRelay = logRelay;
  }

  sessionKey(serial) {
    return serial;
  }

  async getSession(serial) {
    const key = this.sessionKey(serial);
    if (!this.sessions.has(key)) {
      this.sessions.set(key, new StreamSession(serial, MAIN_STREAM_PROFILE, this, this.logRelay));
    }

    return this.sessions.get(key);
  }

  getLatestFrame(serial) {
    const session = this.sessions.get(this.sessionKey(serial));
    if (!session) {
      return null;
    }

    return session.getLatestFrame();
  }

  async broadcastControl(payload) {
    const targets = [];
    for (const session of this.sessions.values()) {
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
