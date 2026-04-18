import LogPanel from "../LogPanel.jsx";

export default function DashboardMainView({
  selectedDevice,
  selectedDeviceInfo,
  isTestingU2,
  handleRefreshDevices,
  handleTestU2OpenSettings,
}) {
  return (
    <main className="flex h-full w-full flex-col gap-4">
      <section className="card fade-in flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Toolbar
          </p>
          <h3 className="mt-1 font-display text-xl text-[var(--ink)]">
            Dashboard controls
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshDevices}
            className="rounded-full bg-[var(--panel-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)]"
          >
            Refresh devices
          </button>
          <button
            type="button"
            onClick={handleTestU2OpenSettings}
            disabled={!selectedDevice || isTestingU2}
            className="rounded-full bg-[var(--chip-success-bg)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--chip-success-fg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTestingU2 ? "Testing U2..." : "Test U2: Send HOME"}
          </button>
        </div>
      </section>

      <section className="card fade-in flex min-h-[220px] flex-1 flex-col justify-between p-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
            Automation sheet
          </p>
          <h1 className="mt-3 font-display text-3xl text-[var(--ink)]">
            Workflow staging area
          </h1>
          <p className="mt-3 max-w-lg text-sm text-[var(--muted)]">
            Connect a device, start a job, and watch live logs stream below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          <span className="rounded-full bg-[var(--chip-warm-bg)] px-3 py-1 text-[var(--ink)]">
            Coming soon: sheet editor
          </span>
          <span>
            {selectedDeviceInfo
              ? `Selected: ${selectedDeviceInfo.id} (${selectedDeviceInfo.u2_status})`
              : "Select a connected device to run controls."}
          </span>
        </div>
      </section>

      <div className="min-h-0 flex-[0.6]">
        <LogPanel />
      </div>
    </main>
  );
}
