import { WebSocketServer } from "ws";

import { MEDIA_SERVER_PORT, PROFILE_ALIASES } from "./config.js";
import { createHealthServer } from "./http-server.js";
import { LogRelay } from "./log-relay.js";
import { StreamManager } from "./stream-manager.js";

function resolveProfile(url) {
  const requested =
    String(url.searchParams.get("profile") || url.searchParams.get("type") || "main").toLowerCase();
  return PROFILE_ALIASES[requested] || "main";
}

export function startMediaServer(port = MEDIA_SERVER_PORT) {
  const server = createHealthServer();
  const wss = new WebSocketServer({ noServer: true });
  const logRelay = new LogRelay();
  const manager = new StreamManager(logRelay);

  logRelay.connect();
  logRelay.log(`Media server booting on port ${port}`);

  server.on("upgrade", async (request, socket, head) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      if (!requestUrl.pathname.startsWith("/stream/")) {
        socket.destroy();
        return;
      }

      const serial = decodeURIComponent(requestUrl.pathname.replace("/stream/", ""));
      const type = resolveProfile(requestUrl);
      logRelay.log(`Stream request: serial=${serial} profile=${type}`);
      const session = await manager.getSession(serial, type);

      wss.handleUpgrade(request, socket, head, (websocket) => {
        wss.emit("connection", websocket, request, session);
      });
    } catch (error) {
      socket.destroy();
    }
  });

  wss.on("connection", async (websocket, request, session) => {
    try {
      await session.attach(websocket);
    } catch (error) {
      websocket.close(1011, "stream_init_failed");
      return;
    }

    websocket.on("message", async (data) => {
      const text = data.toString("utf8");
      try {
        const payload = JSON.parse(text);
        await session.handleMessage(payload);
      } catch (error) {
        // Ignore invalid payloads.
      }
    });

    websocket.on("close", async () => {
      await session.detach(websocket);
    });

    websocket.on("error", async () => {
      await session.detach(websocket);
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      console.log(`Media server listening on http://localhost:${port}`);
      logRelay.log(`Media server listening on http://localhost:${port}`);
      resolve({ server, wss, manager, port });
    });
  });
}
