import { WebSocket } from "ws";

const DEFAULT_RELAY_URL = process.env.BACKEND_WS_LOGS_URL || "ws://localhost:8000/ws/logs";

export class LogRelay {
  constructor(url = DEFAULT_RELAY_URL) {
    this.url = url;
    this.socket = null;
    this.queue = [];
    this.ready = false;
    this.retryTimer = null;
    this.closed = false;
  }

  connect() {
    if (this.closed || this.socket) {
      return;
    }

    this.socket = new WebSocket(this.url);
    this.socket.onopen = () => {
      this.ready = true;
      this.flush();
    };
    this.socket.onclose = () => {
      this.ready = false;
      this.socket = null;
      if (!this.closed) {
        this.scheduleReconnect();
      }
    };
    this.socket.onerror = () => {
      this.ready = false;
      try {
        this.socket?.close();
      } catch (error) {
        // ignore
      }
    };
  }

  scheduleReconnect() {
    if (this.retryTimer) {
      return;
    }

    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.connect();
    }, 1000);
  }

  flush() {
    if (!this.socket || !this.ready) {
      return;
    }

    while (this.queue.length > 0) {
      this.socket.send(this.queue.shift());
    }
  }

  log(message) {
    const line = typeof message === "string" ? message : JSON.stringify(message);
    if (!line) {
      return;
    }

    if (this.socket && this.ready && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(line);
      return;
    }

    this.queue.push(line);
    this.connect();
  }

  async close() {
    this.closed = true;
    this.ready = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    try {
      this.socket?.close();
    } catch (error) {
      // ignore
    }
    this.socket = null;
    this.queue = [];
  }
}
