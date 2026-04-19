import DevicePreviewView from "../../components/DevicePreview/DevicePreviewView";
import DevicePreviewSectionContainer from "./device-preview/index";
import StorageSectionContainer from "./storage";
import { useDeviceWorkspaceTabs } from "./hooks/useDeviceWorkspaceTabs";

export default function DeviceWorkspaceContainer(): JSX.Element {
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
