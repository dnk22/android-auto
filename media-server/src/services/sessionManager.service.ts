import type WebSocket from "ws";
import { config } from "../config";
import { lifecycleHook } from "../hooks/lifecycle.hook";
import type { Session, SessionStatus } from "../types/session";
import { AsyncLock } from "../utils/asyncLock";
import { nowMs } from "../utils/time";
import { log } from "../utils/logger";
import {
  buildConfigMessage,
  buildErrorMessage,
  buildStateMessage,
  isKeyframe,
  wrapFrame,
} from "../utils/streamProtocol";
import { ScrcpyService } from "./scrcpy.service";

const MAX_CLIENT_BUFFERED_BYTES = 1024 * 1024;

export class SessionManager {
  private readonly sessions = new Map<string, Session>();

  private readonly lock = new AsyncLock();

  private readonly scrcpyService: ScrcpyService;

  public constructor(scrcpyService: ScrcpyService) {
    this.scrcpyService = scrcpyService;
  }

  private createSessionId(deviceId: string): string {
    return `${deviceId}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }

  private broadcastJson(session: Session, message: unknown): void {
    const payload = JSON.stringify(message);
    for (const client of session.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  }

  private broadcastState(session: Session): void {
    this.broadcastJson(
      session,
      buildStateMessage(session.sessionId, session.deviceId, session.status, nowMs()),
    );
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
      sessionId: this.createSessionId(deviceId),
      status: "STARTING",
      clients: new Set<WebSocket>(),
      controlClients: new Set<WebSocket>(),
      configuredClients: new WeakSet<WebSocket>(),
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
      this.broadcastState(session);

      log({ level: "info", event: "start_stream", deviceId });

      try {
        const runtime = await this.scrcpyService.start(deviceId, {
          onConfig: (payload) => {
            session.videoCodec = payload.codec;
            session.videoWidth = payload.width;
            session.videoHeight = payload.height;
            if (payload.codecConfig && payload.codecConfig.length > 0) {
              session.codecConfig = payload.codecConfig;
              const configMessage =
                buildConfigMessage(
                  session.sessionId,
                  session.deviceId,
                  session.videoWidth ?? payload.width,
                  session.videoHeight ?? payload.height,
                  session.codecConfig,
                  session.videoCodec,
                );

              this.broadcastJson(session, configMessage);

              for (const client of session.clients) {
                session.configuredClients.add(client);
              }
            }
          },
          onFrame: (frame, keyframeHint) => {
            if (!session.codecConfig || session.codecConfig.length === 0) {
              return;
            }

            const keyframe = keyframeHint ?? isKeyframe(frame);
            const frameTimestamp = nowMs();
            const payload = wrapFrame(frame, keyframe, frameTimestamp);

            session.lastFrame = frame;
            if (keyframe) {
              session.lastKeyframe = frame;
              session.lastKeyframeAt = frameTimestamp;
            }
            session.lastFrameAt = frameTimestamp;

            if (session.status === "STARTING") {
              session.status = "RUNNING";
              this.broadcastState(session);
            }

            for (const client of session.clients) {
              if (client.readyState === client.OPEN) {
                if (!session.configuredClients.has(client)) {
                  continue;
                }

                if (client.bufferedAmount > MAX_CLIENT_BUFFERED_BYTES) {
                  continue;
                }

                client.send(payload, { binary: true });
              }
            }
          },
          onError: (error) => {
            session.status = "ERROR";
            this.broadcastState(session);
            this.broadcastJson(
              session,
              buildErrorMessage(
                session.sessionId,
                session.deviceId,
                "SCRCPY_RUNTIME_ERROR",
                error.message,
                nowMs(),
              ),
            );
            log({ level: "error", event: "scrcpy_error", deviceId, message: error.message });
          },
          onClose: () => {
            if (session.status !== "STOPPED") {
              session.status = "STOPPED";
              this.broadcastState(session);
            }
          },
        });

        session.scrcpy = {
          stop: runtime.stop,
          injectPointer: runtime.injectPointer,
          injectKey: runtime.injectKey,
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
      this.broadcastState(session);

      if (session.idleTimer) {
        clearTimeout(session.idleTimer);
        session.idleTimer = null;
      }

      for (const client of session.clients) {
        if (client.readyState === client.OPEN || client.readyState === client.CONNECTING) {
          client.close(1000, "stream_stopped");
        }
      }

      for (const client of session.controlClients) {
        if (client.readyState === client.OPEN || client.readyState === client.CONNECTING) {
          client.close(1000, "stream_stopped");
        }
      }

      session.clients.clear();
      session.controlClients.clear();

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

  public addControlClient(deviceId: string, client: WebSocket): Session | undefined {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return undefined;
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }

    session.controlClients.add(client);
    return session;
  }

  public markClientConfigured(deviceId: string, client: WebSocket): void {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    session.configuredClients.add(client);
  }

  public removeClient(deviceId: string, client: WebSocket): void {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    session.clients.delete(client);
    lifecycleHook.onClientDisconnect(deviceId, session.clients.size);

    if (session.clients.size === 0 && session.controlClients.size === 0) {
      session.idleTimer = setTimeout(() => {
        void this.stopStream(deviceId, "idle_timeout");
      }, config.idleTimeoutMs);
    }
  }

  public removeControlClient(deviceId: string, client: WebSocket): void {
    const session = this.sessions.get(deviceId);
    if (!session) {
      return;
    }

    session.controlClients.delete(client);

    if (session.clients.size === 0 && session.controlClients.size === 0) {
      session.idleTimer = setTimeout(() => {
        void this.stopStream(deviceId, "idle_timeout");
      }, config.idleTimeoutMs);
    }
  }

  public async injectPointer(
    deviceId: string,
    action: "down" | "move" | "up",
    xRatio: number,
    yRatio: number,
  ): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session || !session.scrcpy?.injectPointer) {
      throw new Error("session_control_unavailable");
    }

    await session.scrcpy.injectPointer(action, xRatio, yRatio);
  }

  public async injectKey(
    deviceId: string,
    key: "back" | "home" | "recents",
  ): Promise<void> {
    const session = this.sessions.get(deviceId);
    if (!session || !session.scrcpy?.injectKey) {
      throw new Error("session_control_unavailable");
    }

    await session.scrcpy.injectKey(key);
  }
}
