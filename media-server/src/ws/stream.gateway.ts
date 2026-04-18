import type { IncomingMessage, Server as HttpServer } from "node:http";
import { WebSocketServer } from "ws";
import type WebSocket from "ws";
import type { SessionManager } from "../services/sessionManager.service";
import {
  buildConfigMessage,
  buildHelloMessage,
  buildStateMessage,
  wrapFrame,
} from "../utils/streamProtocol";
import { log } from "../utils/logger";

const parseDeviceId = (pathname: string): string | null => {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "stream") {
    return null;
  }

  return decodeURIComponent(parts[1]);
};

export const createStreamGateway = (server: HttpServer, sessionManager: SessionManager): void => {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const requestUrl = new URL(request.url ?? "", "http://localhost");
    const deviceId = parseDeviceId(requestUrl.pathname);

    if (!deviceId) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (client) => {
      wss.emit("connection", client, request, deviceId);
    });
  });

  wss.on("connection", (client: WebSocket, _request: IncomingMessage, deviceId: string) => {
    const session = sessionManager.addClient(deviceId, client);

    if (!session) {
      client.close(1008, "session_not_found");
      return;
    }

    log({ level: "info", event: "ws_client_connected", deviceId, clients: session.clients.size });

    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(buildHelloMessage(session.sessionId, session.deviceId)));
      client.send(JSON.stringify(buildStateMessage(
        session.sessionId,
        session.deviceId,
        session.status,
        Date.now(),
      )));

      if (session.codecConfig && session.codecConfig.length > 0) {
        client.send(
          JSON.stringify(
            buildConfigMessage(
              session.sessionId,
              session.deviceId,
              session.videoWidth ?? 0,
              session.videoHeight ?? 0,
              session.codecConfig,
              session.videoCodec,
            ),
          ),
        );
        sessionManager.markClientConfigured(deviceId, client);
      }
    }

    if (
      session.lastKeyframe
      && session.codecConfig
      && session.codecConfig.length > 0
      && client.readyState === client.OPEN
    ) {
      client.send(wrapFrame(session.lastKeyframe, true, session.lastKeyframeAt ?? Date.now()), { binary: true });
    }

    client.on("close", () => {
      sessionManager.removeClient(deviceId, client);
      const refreshed = sessionManager.getSession(deviceId);
      log({
        level: "info",
        event: "ws_client_disconnected",
        deviceId,
        clients: refreshed?.clients.size ?? 0,
      });
    });

    client.on("error", (error) => {
      log({ level: "warn", event: "ws_client_error", deviceId, message: error.message });
    });
  });
};
