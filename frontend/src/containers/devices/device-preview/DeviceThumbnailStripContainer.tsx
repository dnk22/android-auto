import ThumbPollingImage from "../../../components/DevicePreview/ThumbPollingImage";
import DebouncedButton from "../../../components/common/DebouncedButton";
import { formatDeviceLabel, type LegacyDevice } from "../../../types/device";

type DeviceThumbnailStripContainerProps = {
  connectedDevices: LegacyDevice[];
  selectedDevice: string;
  onSelectDevice: (deviceId: string) => void;
};

export default function DeviceThumbnailStripContainer({
  connectedDevices,
  selectedDevice,
  onSelectDevice,
}: DeviceThumbnailStripContainerProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto p-3">
        {connectedDevices.length === 0 ? (
          <div className="flex h-32 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] px-4 text-sm text-[var(--muted)]">
            Chưa có thiết bị CONNECTED
          </div>
        ) : (
          connectedDevices.map((device) => {
            const isActive = device.id === selectedDevice;

            return (
              <DebouncedButton
                key={device.id}
                type="button"
                onClick={() => onSelectDevice(device.id)}
                className={`group relative flex h-28 w-20 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 p-1 text-left transition ${
                  isActive
                    ? "scale-[1.06] border-emerald-400 opacity-100"
                    : "border-slate-500/70 opacity-90"
                }`}
              >
                <div className="relative h-full w-full overflow-hidden rounded-xl bg-[#0f172a]">
                  <ThumbPollingImage
                    serial={device.id}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                    <div className="truncate text-[10px] font-semibold text-white">
                      {formatDeviceLabel(device)}
                    </div>
                  </div>
                </div>
              </DebouncedButton>
            );
          })
        )}
      </div>
    </div>
  );
}
