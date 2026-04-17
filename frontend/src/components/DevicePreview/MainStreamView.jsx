import H264Decoder from "../H264Decoder.jsx";

function ToolbarButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--card-border)] bg-white/70 px-3 py-2 text-xs font-semibold text-[var(--ink)]"
    >
      {label}
    </button>
  );
}

export default function MainStreamView({
  activeStreamDevice,
  selectedDeviceInfo,
  syncAllDevices,
  toggleSyncAllDevices,
  streamState,
  setStreamState,
  onSocketReady,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
  onToolbarAction,
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-display text-2xl text-[var(--ink)]">Main Preview</h4>
          <p className="text-sm text-[var(--muted)]">
            {activeStreamDevice
              ? `Streaming ${activeStreamDevice}`
              : "Select a device thumbnail to begin streaming"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSyncAllDevices}
          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
            syncAllDevices
              ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
              : "bg-[var(--panel-soft)] text-[var(--muted)]"
          }`}
        >
          {syncAllDevices ? "Sync all: ON" : "Sync all: OFF"}
        </button>
      </div>

      <div className="relative flex min-h-[320px] flex-1 overflow-hidden rounded-3xl border border-[var(--card-border)] bg-[#0f172a] shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
        {activeStreamDevice ? (
          <H264Decoder
            serial={activeStreamDevice}
            type="main"
            interactive
            className="h-full w-full"
            onSocketReady={onSocketReady}
            onFrameStateChange={setStreamState}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
            No stream selected
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--panel-soft)] px-4 py-3">
        <div className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
          {selectedDeviceInfo?.state || "DISCONNECTED"}
        </div>
        <div className="flex items-center gap-2">
          <ToolbarButton label="Back" onClick={() => onToolbarAction("back")} />
          <ToolbarButton label="Home" onClick={() => onToolbarAction("home")} />
          <ToolbarButton
            label="Recents"
            onClick={() => onToolbarAction("recents")}
          />
        </div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
          {streamState}
        </div>
      </div>

      <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        MouseDown / MouseMove / MouseUp are sent as normalized coordinates.
      </div>
    </div>
  );
}
