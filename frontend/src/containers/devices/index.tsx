import DevicesTable from "../../components/devices/DevicesTable";
import DevicesToolbar from "../../components/devices/DevicesToolbar";
import { useSidebarController } from "./hooks/useSidebarController";

export default function DevicesContainer(): JSX.Element {
  const {
    devices,
    connectingDeviceId,
    isConnectingAll,
    isDisconnectingAll,
    handleConnect,
    handleDisconnect,
    handleConnectAll,
    handleDisconnectAll,
    canConnect,
    getAdbStatusTone,
    getU2StatusTone,
  } = useSidebarController();

  return (
    <div className="app-shell h-screen w-full overflow-hidden p-4">
      <div className="mx-auto flex h-full w-full max-w-[1400px] min-h-0 flex-col gap-4">
        <h1 className="text-2xl font-semibold text-[var(--ink)]">Thiết bị</h1>

        <DevicesToolbar
          canConnectAll={devices.length > 0 && devices.some((device) => !device.connected)}
          canDisconnectAll={devices.some((device) => device.connected)}
          isConnectingAll={isConnectingAll}
          isDisconnectingAll={isDisconnectingAll}
          onConnectAll={handleConnectAll}
          onDisconnectAll={handleDisconnectAll}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DevicesTable
            devices={devices}
            connectingDeviceId={connectingDeviceId}
            isBulkBusy={isConnectingAll || isDisconnectingAll}
            canConnect={canConnect}
            getAdbStatusTone={getAdbStatusTone}
            getU2StatusTone={getU2StatusTone}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </div>
    </div>
  );
}
