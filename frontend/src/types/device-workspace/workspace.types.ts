import type { ReactNode } from "react";

export type WorkspaceTab = "preview" | "storage";

export interface UseDeviceWorkspaceTabsResult {
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  isPreviewStreamActive: boolean;
  previewTab: WorkspaceTab;
  storageTab: WorkspaceTab;
}

export interface DevicePreviewViewProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  previewTab: WorkspaceTab;
  storageTab: WorkspaceTab;
  shouldRenderPreview: boolean;
  isPreviewStreamActive: boolean;
  previewContent: ReactNode;
  storageContent: ReactNode;
}
