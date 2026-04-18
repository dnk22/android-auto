import type WebSocket from "ws";
import { config } from "../config";
import { lifecycleHook } from "../hooks/lifecycle.hook";
import type { Session, SessionStatus } from "../types/session";
import { AsyncLock } from "../utils/asyncLock";
import { nowMs } from "../utils/time";
import { log } from "../utils/logger";
import { isKeyframe, wrapFrame } from "../utils/streamProtocol";
import { ScrcpyService } from "./scrcpy.service";

const MAX_CLIENT_BUFFERED_BYTES = 1024 * 1024;

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  private readonly lock = new AsyncLock();

  private readonly scrcpyService: ScrcpyService;

  public constructor(scrcpyService: ScrcpyService) {
    this.scrcpyService = scrcpyService;
  }

  public listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  public getSession(deviceId: string): Session | undefined {
    return this.sessions.get(deviceId);
  }

  public createSession(deviceId: string): Session {
    const existing = this.sessions.get(deviceId);
    if (existing) {
      return existing;
    }

    const session: Session = {
      deviceId,
      status: "STARTING",
      clients: new Set<WebSocket>(),
      idleTimer: null,
    };

    this.sessions.set(deviceId, session);
    return session;
  }

  public deleteSession(deviceId: string): void {
    this.sessions.delete(deviceId);
  }

  public setStatus(deviceId: string, status: SessionStatus): void {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    session.status = status;
  }

  public async startStream(deviceId: string): Promise<Session> {
    return this.lock.withLock(deviceId, async () => {
      const existing = this.sessions.get(deviceId);
      if (existing && (existing.status === "STARTING" || existing.status === "RUNNING")) {
        return existing;
      }

      const session = this.createSession(deviceId);
      session.status = "STARTING";

      log({ level: "info", event: "start_stream", deviceId });

      try {
        const runtime = await this.scrcpyService.start(deviceId, {
          onConfig: (payload) => {
            session.videoCodec = payload.codec;
            session.videoWidth = payload.width;
            session.videoHeight = payload.height;
            if (payload.codecConfig && payload.codecConfig.length > 0) {
              session.codecConfig = payload.codecConfig;
            }
          },
          onFrame: (frame, keyframeHint) => {
            const keyframe = keyframeHint ?? isKeyframe(frame);
            const payload = wrapFrame(frame, keyframe);

            session.lastFrame = frame;
            if (keyframe) {
              session.lastKeyframe = session.codecConfig
                ? Buffer.concat([session.codecConfig, frame])
                : frame;
            }
            session.lastFrameAt = nowMs();

            if (session.status === "STARTING") {
              session.status = "RUNNING";
            }

            for (const client of session.clients) {
              if (client.readyState === client.OPEN) {
                if (client.bufferedAmount > MAX_CLIENT_BUFFERED_BYTES) {
                  continue;
                }

                client.send(payload, { binary: true });
              }
            }
          },
          onError: (error) => {
            session.status = "ERROR";
            log({ level: "error", event: "scrcpy_error", deviceId, message: error.message });
          },
          onClose: () => {
            if (session.status !== "STOPPED") {
              session.status = "STOPPED";
            }
          },
        });

        session.scrcpy = {
          stop: runtime.stop,
        };

        lifecycleHook.onSessionStart(deviceId);
        return session;
      } catch (error) {
        session.status = "ERROR";
        const message = error instanceof Error ? error.message : "unknown start failure";
        log({ level: "error", event: "start_stream_failed", deviceId, message });
        throw error;
      }
    });
  }

  public async stopStream(deviceId: string, reason = "manual_stop"): Promise<void> {
    await this.lock.withLock(deviceId, async () => {
      const session = this.sessions.get(deviceId);
      if (!session) {
        return;
      }

      session.status = "STOPPED";

      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
        session.idleTimer = null;
      }

      for (const client of session.clients) {
        if (client.readyState === client.OPEN || client.readyState === client.CONNECTING) {
          client.close(1000, "stream_stopped");
        }
      }

      session.clients.clear();

      await this.scrcpyService.stop(session);
      this.deleteSession(deviceId);
      lifecycleHook.onSessionStop(deviceId, reason);
      log({ level: "info", event: "stop_stream", deviceId, reason });
    });
  }

  public async restartStream(deviceId: string): Promise<Session> {
    await this.stopStream(deviceId, "restart");
    return this.startStream(deviceId);
  }

  public addClient(deviceId: string, client: WebSocket): Session | undefined {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return undefined;
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    session.clients.add(client);
    lifecycleHook.onClientConnect(deviceId, session.clients.size);
    return session;
  }

  public removeClient(deviceId: string, client: WebSocket): void {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    session.clients.delete(client);
    lifecycleHook.onClientDisconnect(deviceId, session.clients.size);

    if (session.clients.size === 0) {
      session.idleTimer = setTimeout(() => {
        void this.stopStream(deviceId, "idle_timeout");
      }, config.idleTimeoutMs);
    }
  }
}
