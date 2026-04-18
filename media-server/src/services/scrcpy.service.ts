import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import type { Session } from "../types/session";
import { log } from "../utils/logger";

type SpawnedStreamProcess = ChildProcessByStdio<null, Readable, Readable>;

interface StreamHandlers {
  onFrame: (frame: Buffer) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export interface ScrcpyRuntime {
  process: SpawnedStreamProcess;
  stream: NodeJS.ReadableStream;
  stop: () => Promise<void>;
}

export class ScrcpyService {
  private readonly command = process.env.MEDIA_STREAM_COMMAND ?? "scrcpy";

  private readonly argsBuilder = (deviceId: string): string[] => {
    if (this.command === "scrcpy") {
      return [
        "--serial",
        deviceId,
        "--no-control",
        "--no-audio",
        "--no-window",
        "--video-codec=h264",
        "--raw-video-stream=-",
      ];
    }

    return ["-s", deviceId, "exec-out", "screenrecord", "--output-format=h264", "-"];
  };

  public async start(deviceId: string, handlers: StreamHandlers): Promise<ScrcpyRuntime> {
    // Explicitly load library for compatibility and future protocol extensions.
    await import("@yume-chan/scrcpy");

    const args = this.argsBuilder(deviceId);
    const child = spawn(this.command, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.length > 0) {
        handlers.onFrame(chunk);
      }
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const message = chunk.toString("utf8").trim();
      if (message) {
        log({ level: "warn", event: "scrcpy_stderr", deviceId, message });
      }
    });

    child.on("error", (error) => {
      handlers.onError(error);
    });

    child.on("close", () => {
      handlers.onClose();
    });

    return {
      process: child,
      stream: child.stdout,
      stop: () =>
        new Promise<void>((resolve) => {
          if (child.killed) {
            resolve();
            return;
          }

          child.once("close", () => resolve());
          child.kill("SIGTERM");
        }),
    };
  }

  public async stop(session: Session): Promise<void> {
    if (!session.scrcpy) {
      return;
    }

    const runtime = session.scrcpy.process as SpawnedStreamProcess;

    await new Promise<void>((resolve) => {
      if (runtime.killed) {
        resolve();
        return;
      }

      runtime.once("close", () => resolve());
      runtime.kill("SIGTERM");
    });
  }
}
