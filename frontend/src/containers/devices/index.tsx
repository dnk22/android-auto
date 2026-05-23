import DevicePreviewSectionContainer from "./components/device-preview";
import DeviceListPanel from "./components/DeviceListPanel";
import { useDeviceThumbnailStripController } from "./hooks/useDeviceThumbnailStripController";

export default function DevicesContainer(): JSX.Element {
  const {
    connectedDevices,
    selectedDevice,
    onSelectDevice,
    onTestU2,
    toggleSyncAllDevices,
    isTestingU2,
    syncAllDevices,
  } = useDeviceThumbnailStripController();

  return (
    <div className="app-shell h-screen w-full overflow-hidden p-2">
      <div className="mx-auto flex h-full w-full min-h-0 flex-col gap-4">
        <aside className="card fade-in grid h-full max-h-full min-h-0 w-full grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[20%_80%]">
          <DeviceListPanel />

          <div className="flex min-h-0 flex-col overflow-hidden pr-4">
            <DevicePreviewSectionContainer
              connectedDevices={connectedDevices}
              selectedDevice={selectedDevice}
              onSelectDevice={onSelectDevice}
              syncAllDevices={syncAllDevices}
              isTestingU2={isTestingU2}
              onToggleSyncAllDevices={toggleSyncAllDevices}
              onTestU2={onTestU2}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
