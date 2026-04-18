import http from "node:http";
import { config } from "./config";
import { createApp } from "./app";
import { ScrcpyService } from "./services/scrcpy.service";
import { SessionManager } from "./services/sessionManager.service";
import { ThumbnailService } from "./services/thumbnail.service";
import { createStreamGateway } from "./ws/stream.gateway";
import { log } from "./utils/logger";

const scrcpyService = new ScrcpyService();
const sessionManager = new SessionManager(scrcpyService);
const thumbnailService = new ThumbnailService(sessionManager);

const app = createApp(sessionManager);
const server = http.createServer(app);

createStreamGateway(server, sessionManager);
thumbnailService.start();

server.listen(config.port, config.host, () => {
  log({
    level: "info",
    event: "server_started",
    host: config.host,
    port: config.port,
  });
});

const shutdown = async (): Promise<void> => {
  thumbnailService.stop();

  const sessions = sessionManager.listSessions();
  await Promise.all(sessions.map((session) => sessionManager.stopStream(session.deviceId, "shutdown")));

  server.close(() => {
    log({ level: "info", event: "server_stopped" });
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
