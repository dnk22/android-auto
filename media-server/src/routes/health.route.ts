import { Router } from "express";
import { healthController } from "../controllers/health.controller";

export const healthRoute = Router();

healthRoute.get("/health", healthController);
