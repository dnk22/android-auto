import DebouncedButton from "../../../components/common/DebouncedButton";
import DeviceThumbnailStripContainer from "./DeviceThumbnailStripContainer";
import MainStreamViewContainer from "./MainStreamViewContainer";
import type { LegacyDevice } from "../../../types/device";

type DevicePreviewSectionContainerProps = {
  connectedDevices: LegacyDevice[];
  selectedDevice: string;
  onSelectDevice: (deviceId: string) => void;
  syncAllDevices: boolean;
  isTestingU2: boolean;
  onToggleSyncAllDevices: () => void;
  onTestU2: () => Promise<void>;
};

export default function DevicePreviewSectionContainer({
  connectedDevices,
  selectedDevice,
  onSelectDevice,
  syncAllDevices,
  isTestingU2,
  onToggleSyncAllDevices,
  onTestU2,
}: DevicePreviewSectionContainerProps): JSX.Element {
  return (
    <>
      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
        Thiết bị đã kết nối
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <DeviceThumbnailStripContainer
              connectedDevices={connectedDevices}
              selectedDevice={selectedDevice}
              onSelectDevice={onSelectDevice}
            />
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <DebouncedButton
              type="button"
              onClick={onToggleSyncAllDevices}
              className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] ${
                syncAllDevices
                  ? "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]"
                  : "bg-[var(--panel-soft)] text-[var(--muted)]"
              }`}
            >
              {syncAllDevices ? "Đồng bộ: ON" : "Đồng bộ: OFF"}
            </DebouncedButton>
            <DebouncedButton
              type="button"
              onClick={() => {
                void onTestU2();
              }}
              disabled={isTestingU2 || (!syncAllDevices && !selectedDevice)}
              className="rounded-xl bg-[var(--panel-soft)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isTestingU2 ? "Test auto..." : "Test auto"}
            </DebouncedButton>
          </div>
        </div>
        <MainStreamViewContainer />
      </div>
    </>
  );
}
