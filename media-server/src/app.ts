import express from "express";
import type { NextFunction, Request, Response } from "express";
import { config } from "./config";
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

  const allowAllOrigins = config.corsOrigins.includes("*");
  const isAllowedOrigin = (origin: string): boolean => config.corsOrigins.includes(origin);

  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;

    if (allowAllOrigins) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (origin && isAllowedOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });

  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);

  app.use(healthRoute);
  app.use(buildControlRoute(controlController));
  app.use(buildThumbnailRoute(thumbnailController));

  app.use(errorHandler);

  return app;
};
