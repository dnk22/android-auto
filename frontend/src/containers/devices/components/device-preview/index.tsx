import DebouncedButton from "../../../../components/common/DebouncedButton";
import type { LegacyDevice } from "../../../../types/device";
import MainStreamViewContainer from "./MainStreamViewContainer";

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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ink)]">
            Thiết bị đã kết nối
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <DebouncedButton
            type="button"
            onClick={onToggleSyncAllDevices}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] ${
              syncAllDevices
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--card-border)] text-[var(--ink)]"
            }`}
          >
            {syncAllDevices ? "Sync all on" : "Sync all"}
          </DebouncedButton>
          <DebouncedButton
            type="button"
            onClick={() => {
              void onTestU2();
            }}
            className="rounded-full border border-[var(--card-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isTestingU2}
          >
            {isTestingU2 ? "Dang test auto..." : "Test auto"}
          </DebouncedButton>
        </div>
      </div>

      <MainStreamViewContainer
        streamDevices={connectedDevices}
        selectedDevice={selectedDevice}
        onSelectDevice={onSelectDevice}
      />
    </div>
  );
}
