import { spawn } from "node:child_process";
import { config } from "../config";
import type { SessionManager } from "./sessionManager.service";
import { log } from "../utils/logger";
import { nowMs } from "../utils/time";

export class ThumbnailService {
  private readonly sessionManager: SessionManager;

  private timer: NodeJS.Timeout | null = null;

  public constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.refreshAll();
    }, config.thumbnailIntervalMs);
  }

  public stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async refreshAll(): Promise<void> {
    const sessions = this.sessionManager.listSessions();

    await Promise.all(
      sessions.map(async (session) => {
        if (!session.lastKeyframe || session.lastKeyframe.length === 0) {
          return;
        }

        const jpeg = await this.toJpeg(session.lastKeyframe);
        if (!jpeg) {
          return;
        }

        session.thumbnail = jpeg;
        session.thumbnailAt = nowMs();
      }),
    );
  }

  private toJpeg(h264Frame: Buffer): Promise<Buffer | null> {
    return new Promise<Buffer | null>((resolve) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-f",
          "h264",
          "-i",
          "pipe:0",
          "-frames:v",
          "1",
          "-f",
          "image2",
          "-vcodec",
          "mjpeg",
          "pipe:1",
        ],
        { stdio: ["pipe", "pipe", "pipe"] },
      );

      const chunks: Buffer[] = [];

      ffmpeg.stdout.on("data", (data: Buffer) => {
        chunks.push(data);
      });

      ffmpeg.stderr.on("data", (data: Buffer) => {
        const message = data.toString("utf8").trim();
        if (message) {
          log({ level: "warn", event: "thumbnail_stderr", message });
        }
      });

      ffmpeg.on("error", (error) => {
        log({ level: "error", event: "thumbnail_ffmpeg_error", message: error.message });
        resolve(null);
      });

      ffmpeg.on("close", (code) => {
        if (code !== 0 || chunks.length === 0) {
          resolve(null);
          return;
        }

        resolve(Buffer.concat(chunks));
      });

      ffmpeg.stdin.end(h264Frame);
    });
  }
}
