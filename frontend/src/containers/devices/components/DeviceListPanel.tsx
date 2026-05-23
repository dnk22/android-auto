import DebouncedButton from "../../../components/common/DebouncedButton";
import { formatDeviceLabel, type LegacyDevice } from "../../../types/device";
import { useSidebarController } from "../hooks/useSidebarController.ts";

function StatusDot({ toneClass }: { toneClass: string }): JSX.Element {
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${toneClass}`} />;
}

export default function DeviceListPanel(): JSX.Element {
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
    <div className="flex min-h-0 flex-col gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-3">
      <h3 className="font-display text-lg text-[var(--ink)]">Danh sach thiet bi</h3>

      <div className="flex items-center gap-2">
        <DebouncedButton
          type="button"
          onClick={() => {
            void handleConnectAll();
          }}
          className="flex-1 rounded-xl bg-[var(--chip-success-bg)] p-3 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !(devices.length > 0 && devices.some((device: LegacyDevice) => !device.connected))
            || isConnectingAll
            || isDisconnectingAll
          }
        >
          {isConnectingAll ? "Dang ket noi..." : "Ket noi tat ca"}
        </DebouncedButton>
        <DebouncedButton
          type="button"
          onClick={() => {
            void handleDisconnectAll();
          }}
          className="flex-1 rounded-xl bg-[var(--chip-danger-bg)] p-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--chip-danger-fg)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={
            !devices.some((device: LegacyDevice) => device.connected)
            || isConnectingAll
            || isDisconnectingAll
          }
        >
          {isDisconnectingAll ? "Dang ngat ket noi..." : "Dung tat ca"}
        </DebouncedButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-[var(--card-border)] bg-[var(--panel)] p-2">
        <div className="space-y-2">
          {devices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-6 text-center text-xs text-[var(--muted)]">
              Khong co thiet bi
            </div>
          ) : (
            devices.map((device: LegacyDevice) => {
              const isConnected = device.connected;
              const isPending = connectingDeviceId === device.id;
              const isBulkBusy = isConnectingAll || isDisconnectingAll;

              return (
                <div
                  key={device.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] p-2"
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
                        Ngat ket noi
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
                        {isPending ? "Dang ket noi..." : "Ket noi"}
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
  );
}
