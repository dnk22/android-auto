import express from "express";
import { healthRoute } from "./routes/health.route";
import { buildControlRoute } from "./routes/control.route";
import { buildThumbnailRoute } from "./routes/thumbnail.route";
import { errorHandler } from "./middleware/error.middleware";
import { requestLogger } from "./middleware/logger.middleware";
import type { SessionManager } from "./services/sessionManager.service";
import { ControlController } from "./controllers/control.controller";
import { ThumbnailController } from "./controllers/thumbnail.controller";

export const createApp = (sessionManager: SessionManager): express.Express => {
  const app = express();

  const controlController = new ControlController(sessionManager);
  const thumbnailController = new ThumbnailController(sessionManager);

  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use(healthRoute);
  app.use(buildControlRoute(controlController));
  app.use(buildThumbnailRoute(thumbnailController));

  app.use(errorHandler);

  return app;
};
