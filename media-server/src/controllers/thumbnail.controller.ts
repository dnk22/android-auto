import type { Request, Response } from "express";
import type { SessionManager } from "../services/sessionManager.service";

export class ThumbnailController {
  public constructor(private readonly sessionManager: SessionManager) {}

  public getThumbnail = (req: Request, res: Response): void => {
    const deviceId = req.params.deviceId;

    const session = this.sessionManager.getSession(deviceId);
    if (!session) {
      res.status(404).json({ ok: false, message: "session_not_found" });
      return;
    }

    if (!session.thumbnail) {
      res.status(204).send();
      return;
    }

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(session.thumbnail);
  };
}
