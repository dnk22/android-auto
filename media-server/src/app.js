import { WebSocketServer } from "ws";

import { MEDIA_SERVER_PORT, PROFILE_ALIASES } from "./config.js";
import { createHealthServer } from "./http-server.js";
import { LogRelay } from "./log-relay.js";
import { StreamManager } from "./stream-manager.js";
import { captureThumbFrame } from "./yume-adb.js";

function resolveProfile(url) {
  const requested =
    String(url.searchParams.get("profile") || url.searchParams.get("type") || "main").toLowerCase();
  return PROFILE_ALIASES[requested] || "main";
}

function resolveMainStreamRequest(url) {
  if (url.pathname.startsWith("/stream/main/")) {
    return {
      serial: decodeURIComponent(url.pathname.replace("/stream/main/", "")),
      type: "main",
    };
  }

  if (url.pathname.startsWith("/stream/thumb/")) {
    return null;
  }

  if (url.pathname.startsWith("/stream/")) {
    const legacyType = resolveProfile(url);
    if (legacyType === "thumb") {
      return null;
    }

    return {
      serial: decodeURIComponent(url.pathname.replace("/stream/", "")),
      type: "main",
    };
  }

  return null;
}

export function startMediaServer(port = MEDIA_SERVER_PORT) {
  const logRelay = new LogRelay();
  const manager = new StreamManager(logRelay);
  const server = createHealthServer({
    onRequest: async (request, response, requestUrl) => {
      if (request.method !== "GET") {
        return false;
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
        const frame = await captureThumbFrame(serial);
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

      const { serial, type } = streamRequest;
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
