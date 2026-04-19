import DevicePreviewView from "../../components/DevicePreview/DevicePreviewView.jsx";
import DevicePreviewSectionContainer from "./device-preview/index.jsx";
import StorageSectionContainer from "./storage";
import { useDeviceWorkspaceTabs } from "./hooks/useDeviceWorkspaceTabs.js";

export default function DeviceWorkspaceContainer() {
  const {
    activeTab,
    setActiveTab,
    isPreviewStreamActive,
    previewTab,
    storageTab,
  } = useDeviceWorkspaceTabs();

  const shouldRenderPreview = activeTab === previewTab || isPreviewStreamActive;

  return (
    <DevicePreviewView
      activeTab={activeTab}
      onTabChange={setActiveTab}
      previewTab={previewTab}
      storageTab={storageTab}
      shouldRenderPreview={shouldRenderPreview}
      isPreviewStreamActive={isPreviewStreamActive}
      previewContent={<DevicePreviewSectionContainer />}
      storageContent={<StorageSectionContainer />}
    />
  );
}
