import { ADB_SERVER_HOST, ADB_SERVER_PORT } from "./config.js";

export async function createAdbContext(serial) {
  const adbModule = await import("@yume-chan/adb");
  const tcpModule = await import("@yume-chan/adb-server-node-tcp");

  const AdbServerClient = adbModule.AdbServerClient || tcpModule.AdbServerClient;
  const AdbServerNodeTcpConnector = tcpModule.AdbServerNodeTcpConnector;

  if (!AdbServerClient || !AdbServerNodeTcpConnector) {
    throw new Error("Required yume-chan ADB classes are not available");
  }

  const connector = new AdbServerNodeTcpConnector({
    host: ADB_SERVER_HOST,
    port: ADB_SERVER_PORT,
  });
  const server = new AdbServerClient(connector);
  const adb = await server.createAdb({ serial });

  const close = async () => {
    await adb.close();
  };

  return {
    adb,
    server,
    close,
  };
}
