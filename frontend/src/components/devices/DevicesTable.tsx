import DebouncedButton from "../common/DebouncedButton";
import type { LegacyDevice } from "../../types/device";

type DevicesTableProps = {
  devices: LegacyDevice[];
  connectingDeviceId: string;
  isBulkBusy: boolean;
  canConnect: (device: LegacyDevice) => boolean;
  getAdbStatusTone: (status: string) => string;
  getU2StatusTone: (status: string) => string;
  onConnect: (targetDeviceId: string) => Promise<void>;
  onDisconnect: (targetDeviceId: string) => Promise<void>;
};

function StatusChip({ label, toneClass }: { label: string; toneClass: string }): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[var(--panel-soft)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${toneClass}`} />
      {label}
    </span>
  );
}

export default function DevicesTable({
  devices,
  connectingDeviceId,
  isBulkBusy,
  canConnect,
  getAdbStatusTone,
  getU2StatusTone,
  onConnect,
  onDisconnect,
}: DevicesTableProps): JSX.Element {
  return (
    <div className="card fade-in overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--card-border)]">
          <thead className="bg-[var(--panel-soft)]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Tên thiết bị
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Trạng thái ADB
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Trạng thái U2
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--card-border)] bg-[var(--panel)]">
            {devices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-[var(--muted)]">
                  Không có thiết bị nào được phát hiện
                </td>
              </tr>
            ) : (
              devices.map((device) => {
                const isConnected = device.connected;
                const isPending = connectingDeviceId === device.id;

                return (
                  <tr key={device.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-[var(--ink)]">
                      {device.id}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        label={String(device.adb_status)}
                        toneClass={getAdbStatusTone(String(device.adb_status))}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip
                        label={String(device.u2_status)}
                        toneClass={getU2StatusTone(String(device.u2_status))}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isConnected ? (
                        <DebouncedButton
                          type="button"
                          onClick={() => {
                            void onDisconnect(device.id);
                          }}
                          className="rounded-md bg-[var(--chip-danger-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--chip-danger-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={isPending || isBulkBusy}
                        >
                          Ngắt kết nối
                        </DebouncedButton>
                      ) : (
                        <DebouncedButton
                          type="button"
                          onClick={() => {
                            void onConnect(device.id);
                          }}
                          className="rounded-md bg-[var(--chip-success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--chip-success-fg)] disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!canConnect(device) || isPending || isBulkBusy}
                        >
                          {isPending ? "Đang kết nối..." : "Kết nối"}
                        </DebouncedButton>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
