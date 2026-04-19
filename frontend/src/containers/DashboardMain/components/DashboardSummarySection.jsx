export default function DashboardSummarySection({ selectedDeviceInfo }) {
  return (
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
        <span className="rounded-full bg-[var(--chip-success-bg)] px-3 py-1 text-[var(--chip-success-fg)]">
          Automation editor live
        </span>
        <span>
          {selectedDeviceInfo
            ? `Selected: ${selectedDeviceInfo.id} (${selectedDeviceInfo.u2_status})`
            : "Select a connected device to run controls."}
        </span>
      </div>
    </section>
  );
}
