import type { NextFunction, Request, Response } from "express";
import { log } from "../utils/logger";

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const message = error instanceof Error ? error.message : "internal_server_error";
  log({ level: "error", event: "http_error", message });

  res.status(500).json({
    ok: false,
    message,
  });
};
