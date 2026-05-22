import DebouncedButton from "../../components/common/DebouncedButton";
import { formatDeviceLabel, type LegacyDevice } from "../../types/device";
import DevicePreviewSectionContainer from "./device-preview";
import { useDeviceThumbnailStripController } from "./device-preview/hooks/useDeviceThumbnailStripController";
import { useSidebarController } from "./hooks/useSidebarController";

function StatusDot({ toneClass }: { toneClass: string }): JSX.Element {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${toneClass}`} />;
}

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

  const {
    connectedDevices,
    selectedDevice,
    onSelectDevice,
    onTestU2,
    toggleSyncAllDevices,
    isTestingU2,
    syncAllDevices,
  } = useDeviceThumbnailStripController();

  return (
    <div className="app-shell h-screen w-full overflow-hidden p-2">
      <div className="mx-auto flex h-full w-full min-h-0 flex-col gap-4">
        <aside className="card fade-in grid h-full max-h-full min-h-0 w-full grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[20%_80%]">
          <div className="flex min-h-0 flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-3">
            <h3 className="font-display text-lg text-[var(--ink)]">Danh sách thiết bị</h3>

            <div className="flex items-center gap-2">
              <DebouncedButton
                type="button"
                onClick={() => {
                  void handleConnectAll();
                }}
                className="flex-1 rounded-xl bg-[var(--chip-success-bg)] p-3 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  !(devices.length > 0 && devices.some((device) => !device.connected)) ||
                  isConnectingAll ||
                  isDisconnectingAll
                }
              >
                {isConnectingAll ? "Đang kết nối..." : "Kết nối tất cả"}
              </DebouncedButton>
              <DebouncedButton
                type="button"
                onClick={() => {
                  void handleDisconnectAll();
                }}
                className="flex-1 rounded-xl bg-[var(--chip-danger-bg)] p-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--chip-danger-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  !devices.some((device) => device.connected) ||
                  isConnectingAll ||
                  isDisconnectingAll
                }
              >
                {isDisconnectingAll ? "Đang ngắt kết nối..." : "Dừng tất cả"}
              </DebouncedButton>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-2">
              <div className="space-y-2">
                {devices.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-6 text-center text-xs text-[var(--muted)]">
                    Không có thiết bị
                  </div>
                ) : (
                  devices.map((device: LegacyDevice) => {
                    const isConnected = device.connected;
                    const isPending = connectingDeviceId === device.id;
                    const isBulkBusy = isConnectingAll || isDisconnectingAll;

                    return (
                      <div
                        key={device.id}
                        className="rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] flex flex-col p-2 gap-2"
                      >
                        <p className="truncate text-xs font-semibold text-[var(--ink)]">
                          {formatDeviceLabel(device)}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-[var(--muted)]">
                          <span>ADB</span>
                          <StatusDot toneClass={getAdbStatusTone(String(device.adb_status))} />
                          <span>U2</span>
                          <StatusDot toneClass={getU2StatusTone(String(device.u2_status))} />
                        </div>
                        <div className="mt-2">
                          {isConnected ? (
                            <DebouncedButton
                              type="button"
                              onClick={() => {
                                void handleDisconnect(device.id);
                              }}
                              className="w-full rounded-md bg-[var(--chip-danger-bg)] p-3 text-[14px] font-semibold text-[var(--chip-danger-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={isPending || isBulkBusy}
                            >
                              Ngắt kết nối
                            </DebouncedButton>
                          ) : (
                            <DebouncedButton
                              type="button"
                              onClick={() => {
                                void handleConnect(device.id);
                              }}
                              className="w-full rounded-md bg-[var(--chip-success-bg)] p-3 text-[14px] font-semibold text-[var(--chip-success-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                              disabled={!canConnect(device) || isPending || isBulkBusy}
                            >
                              {isPending ? "Đang kết nối..." : "Kết nối"}
                            </DebouncedButton>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden pr-4">
            <DevicePreviewSectionContainer
              connectedDevices={connectedDevices}
              selectedDevice={selectedDevice}
              onSelectDevice={onSelectDevice}
              syncAllDevices={syncAllDevices}
              isTestingU2={isTestingU2}
              onToggleSyncAllDevices={toggleSyncAllDevices}
              onTestU2={onTestU2}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
