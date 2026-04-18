import { WebSocketServer } from "ws";

import { MEDIA_SERVER_PORT } from "./config.js";
import { createHealthServer } from "./http-server.js";
import { LogRelay } from "./log-relay.js";
import { StreamManager } from "./stream-manager.js";
import { captureThumbFrame } from "./yume-adb.js";

function resolveMainStreamRequest(url) {
  if (url.pathname.startsWith("/stream/thumb/")) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "stream") {
    return null;
  }

  return decodeURIComponent(parts[1] || "");
}

export function startMediaServer(port = MEDIA_SERVER_PORT) {
  const logRelay = new LogRelay();
  const manager = new StreamManager(logRelay);
  const server = createHealthServer({
    getHealthPayload: () => {
      const health = manager.getHealthSnapshot();
      return {
        mediaServer: {
          streamCount: health.streamCount,
          totalClients: health.totalClients,
        },
      };
    },
    onRequest: async (request, response, requestUrl) => {
      if (request.method !== "GET") {
        return false;
      }

      if (requestUrl.pathname === "/health/streams") {
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            ok: true,
            ts: Date.now(),
            ...manager.getHealthSnapshot(),
          })
        );
        return true;
      }

      if (requestUrl.pathname.startsWith("/health/stream/")) {
        const serial = decodeURIComponent(requestUrl.pathname.replace("/health/stream/", ""));
        const stats = manager.getSessionStats(serial);
        if (!stats) {
          response.writeHead(404, { "Content-Type": "application/json" });
          response.end(JSON.stringify({ error: "stream_not_found", serial }));
          return true;
        }

        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            ok: true,
            ts: Date.now(),
            stream: stats,
          })
        );
        return true;
      }

      if (!requestUrl.pathname.startsWith("/stream/thumb/")) {
        return false;
      }

      const serial = decodeURIComponent(requestUrl.pathname.replace("/stream/thumb/", ""));
      if (!serial) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "serial_required" }));
        return true;
      }

      try {
        const preferredFrame = manager.getLatestFrame(serial);
        const frame = await captureThumbFrame(serial, {
          preferredFrame,
        });
        response.writeHead(200, {
          "Content-Type": "image/webp",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        });
        response.end(frame);
      } catch (error) {
        logRelay.log(`Thumb request failed: serial=${serial} error=${error?.message || String(error)}`);
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            error: "thumb_capture_failed",
            message: error?.message || String(error),
          })
        );
      }

      return true;
    },
  });
  const wss = new WebSocketServer({ noServer: true });

  logRelay.connect();
  logRelay.log(`Media server booting on port ${port}`);

  server.on("upgrade", async (request, socket, head) => {
    try {
      const requestUrl = new URL(request.url, "http://localhost");
      const streamRequest = resolveMainStreamRequest(requestUrl);
      if (!streamRequest) {
        socket.destroy();
        return;
      }

      const serial = streamRequest;
      logRelay.log(`Stream request: serial=${serial}`);
      const session = await manager.getSession(serial);

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
