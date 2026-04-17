export default function DevicePreviewView({
  activeTab,
  onTabChange,
  previewTab,
  storageTab,
  shouldRenderPreview,
  isPreviewStreamActive,
  previewContent,
  storageContent,
}) {
  return (
    <aside className="card fade-in flex h-full max-h-full min-h-0 w-full flex-col gap-4 overflow-hidden p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">
          {activeTab === previewTab ? "Device Preview" : "Storage"}
        </h3>
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] bg-[var(--panel-soft)] p-1">
          <button
            type="button"
            onClick={() => onTabChange(previewTab)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              activeTab === previewTab
                ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
                : "text-[var(--muted)]"
            }`}
          >
            Device preview
          </button>
          <button
            type="button"
            onClick={() => onTabChange(storageTab)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              activeTab === storageTab
                ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
                : "text-[var(--muted)]"
            }`}
          >
            Storage
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {shouldRenderPreview ? (
          <div
            className={`${activeTab === previewTab ? "flex" : "hidden"} min-h-0 flex-1 flex-col overflow-hidden`}
          >
            {previewContent}
          </div>
        ) : null}

        {activeTab === storageTab ? (
          <div className="min-h-0 flex-1 overflow-auto">{storageContent}</div>
        ) : null}

        {activeTab !== previewTab && !isPreviewStreamActive ? (
          <p className="mt-3 rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-[var(--muted)]">
            Device preview stream is paused after 10s in background.
          </p>
        ) : null}
      </div>
    </aside>
  );
}
