import { access } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import type { Adb } from "@yume-chan/adb";
import type { AdbScrcpyOptionsLatest } from "@yume-chan/adb-scrcpy";
import type { ScrcpyMediaStreamPacket } from "@yume-chan/scrcpy";
import { config } from "../config";
import type { Session } from "../types/session";
import { log } from "../utils/logger";
import { deriveAvcCodecString } from "../utils/streamProtocol";

interface StreamHandlers {
  onConfig: (payload: {
    codec: string;
    width: number;
    height: number;
    codecConfig?: Buffer;
  }) => void;
  onFrame: (frame: Buffer, keyframeHint?: boolean) => void;
  onError: (error: Error) => void;
  onClose: () => void;
}

export interface ScrcpyRuntime {
  stop: () => Promise<void>;
}

interface ScrcpyModules {
  AdbServerClient: typeof import("@yume-chan/adb").AdbServerClient;
  AdbServerNodeTcpConnector: typeof import("@yume-chan/adb-server-node-tcp").AdbServerNodeTcpConnector;
  AdbScrcpyClient: typeof import("@yume-chan/adb-scrcpy").AdbScrcpyClient;
  AdbScrcpyOptionsLatest: typeof import("@yume-chan/adb-scrcpy").AdbScrcpyOptionsLatest;
  AdbScrcpyExitedError: typeof import("@yume-chan/adb-scrcpy").AdbScrcpyExitedError;
}

export class ScrcpyService {
  private modulesPromise?: Promise<ScrcpyModules>;

  private async loadModules(): Promise<ScrcpyModules> {
    if (!this.modulesPromise) {
      this.modulesPromise = (async () => {
        const adb = await import("@yume-chan/adb");
        const adbServerNodeTcp = await import("@yume-chan/adb-server-node-tcp");
        const adbScrcpy = await import("@yume-chan/adb-scrcpy");

        return {
          AdbServerClient: adb.AdbServerClient,
          AdbServerNodeTcpConnector: adbServerNodeTcp.AdbServerNodeTcpConnector,
          AdbScrcpyClient: adbScrcpy.AdbScrcpyClient,
          AdbScrcpyOptionsLatest: adbScrcpy.AdbScrcpyOptionsLatest,
          AdbScrcpyExitedError: adbScrcpy.AdbScrcpyExitedError,
        };
      })();
    }

    return this.modulesPromise;
  }

  private async ensureServerBinary(
    adb: Adb,
    modules: ScrcpyModules,
  ): Promise<void> {
    if (!config.scrcpyServerLocalPath) {
      return;
    }

    await access(config.scrcpyServerLocalPath);
    const stream = Readable.toWeb(
      createReadStream(config.scrcpyServerLocalPath),
    );
    await modules.AdbScrcpyClient.pushServer(
      adb,
      stream as never,
      config.scrcpyServerDevicePath,
    );
  }

  public async start(
    deviceId: string,
    handlers: StreamHandlers,
  ): Promise<ScrcpyRuntime> {
    const modules = await this.loadModules();
    const adbClient = new modules.AdbServerClient(
      new modules.AdbServerNodeTcpConnector({
        host: config.adbServerHost,
        port: config.adbServerPort,
      }),
    );

    const adb = await adbClient.createAdb({ serial: deviceId });
    await this.ensureServerBinary(adb, modules);

    const options: AdbScrcpyOptionsLatest<true> =
      new modules.AdbScrcpyOptionsLatest(
        {
          video: true,
          videoCodec: "h264",

          maxSize: 1024, // 🔥 QUAN TRỌNG
          videoBitRate: 1_000_000, // giảm xuống
          maxFps: 60,

          sendFrameMeta: true,
          sendCodecMeta: true,
          tunnelForward: true,

          audio: false,
          control: false,
          cleanup: false,
        },
        {
          version: config.scrcpyClientVersion,
        },
      );

    let client;
    try {
      client = await modules.AdbScrcpyClient.start(
        adb,
        config.scrcpyServerDevicePath,
        options,
      );
    } catch (error) {
      await adb.close();
      if (error instanceof modules.AdbScrcpyExitedError) {
        const output = error.output.join(" | ").trim() || "(no output)";
        throw new Error(
          `scrcpy server exited prematurely: ${output}. ` +
            "Set MEDIA_SCRCPY_SERVER_LOCAL_PATH to a valid scrcpy-server binary or ensure compatible server exists on device.",
        );
      }

      throw error;
    }
    const video = await client.videoStream;

    if (!video) {
      await client.close();
      await adb.close();
      throw new Error("scrcpy_video_stream_unavailable");
    }

    handlers.onConfig({
      codec: "h264",
      width: video.width,
      height: video.height,
    });

    const packetReader = video.stream.getReader();
    const outputReader = client.output.getReader();
    let closed = false;

    const emitClose = () => {
      if (closed) {
        return;
      }
      closed = true;
      handlers.onClose();
    };

    void (async () => {
      try {
        while (true) {
          const { done, value } = await outputReader.read();
          if (done) {
            break;
          }

          const message = String(value ?? "").trim();
          if (message) {
            log({ level: "warn", event: "scrcpy_output", deviceId, message });
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          handlers.onError(error);
        }
      }
    })();

    void (async () => {
      try {
        while (true) {
          const { done, value } = await packetReader.read();
          if (done) {
            break;
          }

          const packet = value as ScrcpyMediaStreamPacket;
          if (packet.type === "configuration") {
            const codecConfig = Buffer.from(packet.data);
            handlers.onConfig({
              codec: deriveAvcCodecString(codecConfig),
              width: video.width,
              height: video.height,
              codecConfig,
            });
            continue;
          }

          handlers.onFrame(Buffer.from(packet.data), packet.keyframe);
        }
      } catch (error) {
        if (error instanceof Error) {
          handlers.onError(error);
        }
      } finally {
        emitClose();
      }
    })();

    void client.exited
      .then(() => {
        emitClose();
      })
      .catch((error) => {
        if (error instanceof Error) {
          handlers.onError(error);
        }
        emitClose();
      });

    return {
      stop: async () => {
        await packetReader.cancel();
        await outputReader.cancel();
        await client.close();
        await adb.close();
      },
    };
  }

  public async stop(session: Session): Promise<void> {
    if (!session.scrcpy?.stop) {
      return;
    }

    await session.scrcpy.stop();
  }
}
