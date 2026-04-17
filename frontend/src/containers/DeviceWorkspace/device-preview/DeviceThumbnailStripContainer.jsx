import H264Decoder from "../../../components/H264Decoder.jsx";
import { useDeviceThumbnailStripController } from "./hooks/useDeviceThumbnailStripController.js";

export default function DeviceThumbnailStripContainer() {
  const {
    connectedDevices,
    selectedDevice,
    onSelectDevice,
    getBorderClass,
    toggleSyncAllDevices,
    syncAllDevices,
  } = useDeviceThumbnailStripController();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          Thiết bị đã kết nối
        </p>
        <button
          type="button"
          onClick={toggleSyncAllDevices}
          className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
            syncAllDevices
              ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
              : "bg-[var(--panel-soft)] text-[var(--muted)]"
          }`}
        >
          {syncAllDevices ? "Đồng bộ: ON" : "Đồng bộ: OFF"}
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {connectedDevices.length === 0 ? (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] px-4 text-sm text-[var(--muted)]">
            Chưa có thiết bị CONNECTED
          </div>
        ) : (
          connectedDevices.map((device) => {
            const isActive = device.id === selectedDevice;
            const borderClass = getBorderClass(device.state);

            return (
              <button
                key={device.id}
                type="button"
                onClick={() => onSelectDevice(device.id)}
                className={`group relative flex h-32 w-24 shrink-0 flex-col overflow-hidden rounded-2xl border-2 p-1 text-left transition ${
                  isActive ? "scale-[1.02]" : "opacity-90"
                } ${borderClass}`}
              >
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#0f172a]">
                  <H264Decoder
                    serial={device.id}
                    type="thumb"
                    className="absolute inset-0 h-full w-full"
                    onFrameStateChange={() => null}
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                    <div className="truncate text-[10px] font-semibold text-white">
                      {device.id}
                    </div>
                    <div className="text-[9px] uppercase tracking-[0.08em] text-slate-200">
                      {device.state}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
