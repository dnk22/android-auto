import type { NextFunction, Request, Response } from "express";
import { log } from "../utils/logger";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startedAt = Date.now();

  res.on("finish", () => {
    log({
      level: "info",
      event: "http_request",
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
};
