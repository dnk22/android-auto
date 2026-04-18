import type { Request, Response } from "express";
import type { DeviceRequest, StreamStatusResponse } from "../types/api";
import type { SessionManager } from "../services/sessionManager.service";

const readDeviceId = (req: Request): string | null => {
  const body = req.body as Partial<DeviceRequest>;
  if (typeof body.deviceId !== "string" || body.deviceId.length === 0) {
    return null;
  }

  return body.deviceId;
};

export class ControlController {
  public constructor(private readonly sessionManager: SessionManager) {}

  public startStream = async (req: Request, res: Response): Promise<void> => {
    const deviceId = readDeviceId(req);
    if (!deviceId) {
      res.status(400).json({ ok: false, message: "deviceId_required" });
      return;
    }

    await this.sessionManager.startStream(deviceId);
    res.status(200).json({ ok: true, message: "stream_started" });
  };

  public stopStream = async (req: Request, res: Response): Promise<void> => {
    const deviceId = readDeviceId(req);
    if (!deviceId) {
      res.status(400).json({ ok: false, message: "deviceId_required" });
      return;
    }

    await this.sessionManager.stopStream(deviceId, "api_stop");
    res.status(200).json({ ok: true, message: "stream_stopped" });
  };

  public restartStream = async (req: Request, res: Response): Promise<void> => {
    const deviceId = readDeviceId(req);
    if (!deviceId) {
      res.status(400).json({ ok: false, message: "deviceId_required" });
      return;
    }

    await this.sessionManager.restartStream(deviceId);
    res.status(200).json({ ok: true, message: "stream_restarted" });
  };

  public streamStatus = (req: Request, res: Response): void => {
    const deviceId = req.query.deviceId;
    if (typeof deviceId !== "string" || deviceId.length === 0) {
      res.status(400).json({ ok: false, message: "deviceId_required" });
      return;
    }

    const session = this.sessionManager.getSession(deviceId);

    const payload: StreamStatusResponse = {
      deviceId,
      exists: Boolean(session),
      status: session?.status ?? "NOT_FOUND",
      clients: session?.clients.size ?? 0,
      lastFrameAt: session?.lastFrameAt,
      thumbnailAt: session?.thumbnailAt,
    };

    res.status(200).json(payload);
  };
}
