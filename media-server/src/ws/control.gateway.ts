import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { SessionManager } from "../services/sessionManager.service";
import { log } from "../utils/logger";

type PointerAction = "down" | "move" | "up";
type ControlMessage =
  | {
      type: "pointer";
      action: PointerAction;
      x: number;
      y: number;
    }
  | {
      type: "key";
      key: "back" | "home" | "recents";
    };

type MoveControlMessage = {
  type: "pointer";
  action: "move";
  x: number;
  y: number;
};

const MOVE_COALESCE_INTERVAL_MS = 16;

const parseDeviceId = (pathname: string): string | null => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 3 || parts[0] !== "ws" || parts[1] !== "control") {
    return null;
  }

  return decodeURIComponent(parts[2]);
};

const isPointerAction = (value: unknown): value is PointerAction =>
  value === "down" || value === "move" || value === "up";

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

const parseControlMessage = (raw: string): ControlMessage | null => {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const message = payload as Record<string, unknown>;

  if (message.type === "pointer") {
    if (!isPointerAction(message.action)) {
      return null;
    }

    const x = toFiniteNumber(message.x);
    const y = toFiniteNumber(message.y);
    if (x === null || y === null) {
      return null;
    }

    return {
      type: "pointer",
      action: message.action,
      x,
      y,
    };
  }

  if (message.type === "key") {
    const key = message.key ?? message.action;
    if (key !== "back" && key !== "home" && key !== "recents") {
      return null;
    }

    return {
      type: "key",
      key,
    };
  }

  return null;
};

export const createControlGateway = (server: HttpServer, sessionManager: SessionManager): void => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "", "http://localhost");
    const deviceId = parseDeviceId(requestUrl.pathname);
    if (!deviceId) {
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request, deviceId);
    });
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, deviceId: string) => {
    const session = sessionManager.addControlClient(deviceId, client);
    if (!session) {
      client.close(1008, "session_not_found");
      return;
    }

    log({
      level: "info",
      event: "control_ws_client_connected",
      deviceId,
      clients: session.controlClients.size,
    });

    let processing = false;
    let moveTimer: NodeJS.Timeout | null = null;
    let latestMove: MoveControlMessage | null = null;
    const queue: ControlMessage[] = [];

    const dispatch = async (message: ControlMessage): Promise<void> => {
      if (message.type === "pointer") {
        await sessionManager.injectPointer(deviceId, message.action, message.x, message.y);
        return;
      }

      await sessionManager.injectKey(deviceId, message.key);
    };

    const pump = async (): Promise<void> => {
      if (processing) {
        return;
      }

      processing = true;
      try {
        while (queue.length > 0 || latestMove !== null) {
          const message = queue.shift() ?? latestMove;
          if (!message) {
            break;
          }

          if (message.type === "pointer" && message.action === "move") {
            latestMove = null;
          }

          try {
            await dispatch(message);
          } catch (error) {
            const messageText = error instanceof Error ? error.message : "control_dispatch_failed";
            if (client.readyState === client.OPEN) {
              client.send(
                JSON.stringify({
                  type: "error",
                  message: messageText,
                }),
              );
            }
            log({
              level: "warn",
              event: "control_dispatch_failed",
              deviceId,
              message: messageText,
            });
          }
        }
      } finally {
        processing = false;
        if (queue.length > 0 || latestMove !== null) {
          void pump();
        }
      }
    };

    const scheduleMovePump = (): void => {
      if (moveTimer) {
        return;
      }

      moveTimer = setTimeout(() => {
        moveTimer = null;
        void pump();
      }, MOVE_COALESCE_INTERVAL_MS);
    };

    client.on("message", (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString("utf8");
      const message = parseControlMessage(text);
      if (!message) {
        log({
          level: "warn",
          event: "control_ws_invalid_message",
          deviceId,
          message: text.slice(0, 200),
        });
        return;
      }

      if (message.type === "pointer" && message.action === "move") {
        latestMove = message as MoveControlMessage;
        scheduleMovePump();
        return;
      }

      if (message.type === "pointer" && message.action === "up" && latestMove) {
        queue.push(latestMove);
        latestMove = null;
      }

      queue.push(message);
      void pump();
    });

    client.on("close", () => {
      if (moveTimer) {
        clearTimeout(moveTimer);
        moveTimer = null;
      }

      sessionManager.removeControlClient(deviceId, client);
      const refreshed = sessionManager.getSession(deviceId);
      log({
        level: "info",
        event: "control_ws_client_disconnected",
        deviceId,
        clients: refreshed?.controlClients.size ?? 0,
      });
    });

    client.on("error", (error) => {
      log({ level: "warn", event: "control_ws_client_error", deviceId, message: error.message });
    });
  });
};
