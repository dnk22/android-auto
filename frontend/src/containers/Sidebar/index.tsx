import { useSidebarController } from "./hooks/useSidebarController";

export default function SidebarContainer(): JSX.Element {
  const {
    devices,
    theme,
    toggleTheme,
    connectingDeviceId,
    isConnectingAll,
    isDisconnectingAll,
    handleRefreshDevices,
    handleConnect,
    handleDisconnect,
    handleConnectAll,
    handleDisconnectAll,
    canConnect,
    getAdbStatusTone,
    getU2StatusTone,
  } = useSidebarController();

  return (
    <aside className="card fade-in h-full w-full p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-2xl">Control Center</h3>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-full border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)]"
        >
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>
      <div className="mt-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Thiết bị đã kết nối
            </p>
            <button
              type="button"
              onClick={handleRefreshDevices}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--panel-soft)] text-[var(--ink)] transition hover:opacity-90"
              aria-label="Refresh devices"
              title="Refresh devices"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-3-6.7" />
                <path d="M21 3v6h-6" />
              </svg>
            </button>
          </div>
          <div className="flex w-full items-center gap-2">
            <button
              type="button"
              onClick={handleConnectAll}
              className="w-1/2 rounded-full bg-[var(--chip-success-bg)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--chip-success-fg)] disabled:cursor-not-allowed"
              disabled={
                devices.length === 0 ||
                isConnectingAll ||
                isDisconnectingAll ||
                devices.every((device) => device.connected)
              }
            >
              {isConnectingAll ? "Đang kết nối..." : "Kết nối tất cả"}
            </button>
            <button
              type="button"
              onClick={handleDisconnectAll}
              className="w-1/2 rounded-full bg-[var(--chip-danger-bg)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--chip-danger-fg)] disabled:cursor-not-allowed"
              disabled={
                !devices.some((device) => device.connected) ||
                isConnectingAll ||
                isDisconnectingAll
              }
            >
              {isDisconnectingAll ? "Đang dừng..." : "Dừng tất cả"}
            </button>
          </div>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {devices.length === 0 ? (
            <li className="text-[var(--muted)]">
              <div className="flex h-20 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] px-4 text-sm text-[var(--muted)]">
                Không có thiết bị nào được phát hiện
              </div>
            </li>
          ) : (
            devices.map((device) => {
              const isConnected = device.connected;

              return (
                <li
                  key={device.id}
                  className={`group rounded-lg px-3 py-2 ${
                    isConnected
                      ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
                      : "bg-[var(--panel-soft)] text-[var(--ink)]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate">{device.id}</span>
                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <button
                          type="button"
                          onClick={() => handleDisconnect(device.id)}
                          className="inline-block rounded-full bg-[var(--chip-danger-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--chip-danger-fg)]"
                          disabled={
                            connectingDeviceId === device.id ||
                            isConnectingAll ||
                            isDisconnectingAll
                          }
                        >
                          Dừng
                        </button>
                      ) : canConnect(device) ? (
                        <button
                          type="button"
                          onClick={() => handleConnect(device.id)}
                          className="inline-block rounded-full bg-[var(--chip-success-bg)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--chip-success-fg)]"
                          disabled={
                            connectingDeviceId === device.id ||
                            isConnectingAll ||
                            isDisconnectingAll
                          }
                        >
                          {connectingDeviceId === device.id
                            ? "Đang kết nối..."
                            : "Kết nối"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-[var(--muted)]">
                    <span className="rounded-full bg-[var(--chip-muted-bg)] px-2 py-1 text-[var(--chip-muted-fg)]">
                      <span className="mr-1 inline-flex h-2 w-2 rounded-full align-middle">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${getAdbStatusTone(
                            device.adb_status,
                          )}`}
                        />
                      </span>
                      adb
                    </span>
                    <span className="rounded-full bg-[var(--chip-muted-bg)] px-2 py-1 text-[var(--chip-muted-fg)]">
                      <span className="mr-1 inline-flex h-2 w-2 rounded-full align-middle">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${getU2StatusTone(
                            device.u2_status,
                          )}`}
                        />
                      </span>
                      u2
                    </span>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </aside>
  );
}
