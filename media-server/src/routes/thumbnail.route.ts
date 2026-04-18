import { Router } from "express";
import type { ThumbnailController } from "../controllers/thumbnail.controller";

export const buildThumbnailRoute = (controller: ThumbnailController): Router => {
  const route = Router();
  route.get("/thumbnail/:deviceId", controller.getThumbnail);
  return route;
};
