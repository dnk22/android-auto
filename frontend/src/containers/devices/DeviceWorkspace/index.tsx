import DevicePreviewSectionContainer from "../components/device-preview";
import { useDeviceThumbnailStripController } from "../hooks/useDeviceThumbnailStripController";

export default function DeviceWorkspaceContainer(): JSX.Element {
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
    <div className="flex min-h-0 flex-1 flex-col">
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
  );
}
