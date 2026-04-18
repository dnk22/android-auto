import { Router, type RequestHandler } from "express";
import type { ControlController } from "../controllers/control.controller";

const asyncHandler = (handler: RequestHandler): RequestHandler => (
  req,
  res,
  next,
) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const buildControlRoute = (controller: ControlController): Router => {
  const route = Router();

  route.post("/start-stream", asyncHandler(controller.startStream));
  route.post("/stop-stream", asyncHandler(controller.stopStream));
  route.post("/restart-stream", asyncHandler(controller.restartStream));
  route.get("/stream-status", controller.streamStatus);

  return route;
};
