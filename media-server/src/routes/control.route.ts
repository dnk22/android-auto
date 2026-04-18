import { Router } from "express";
import type { ControlController } from "../controllers/control.controller";

export const buildControlRoute = (controller: ControlController): Router => {
  const route = Router();

  route.post("/start-stream", controller.startStream);
  route.post("/stop-stream", controller.stopStream);
  route.post("/restart-stream", controller.restartStream);
  route.get("/stream-status", controller.streamStatus);

  return route;
};
