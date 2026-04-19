import { useEffect, useRef, useState } from "react";
import type {
  UseDeviceWorkspaceTabsResult,
  WorkspaceTab,
} from "../../../types/device-workspace/workspace.types";

const PREVIEW_TAB: WorkspaceTab = "preview";
const STORAGE_TAB: WorkspaceTab = "storage";
const PREVIEW_STREAM_GRACE_MS = 10_000;

export function useDeviceWorkspaceTabs(): UseDeviceWorkspaceTabsResult {
  const [activeTab, setActiveTab] = useState(PREVIEW_TAB);
  const [isPreviewStreamActive, setIsPreviewStreamActive] = useState(true);
  const pauseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeTab === PREVIEW_TAB) {
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current);
      }
      pauseTimerRef.current = null;
      setIsPreviewStreamActive(true);
      return undefined;
    }

    pauseTimerRef.current = window.setTimeout(() => {
      setIsPreviewStreamActive(false);
      pauseTimerRef.current = null;
    }, PREVIEW_STREAM_GRACE_MS);

    return () => {
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    };
  }, [activeTab]);

  useEffect(
    () => () => {
      if (pauseTimerRef.current) {
        window.clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = null;
      }
    },
    [],
  );

  return {
    activeTab,
    setActiveTab,
    isPreviewStreamActive,
    previewTab: PREVIEW_TAB,
    storageTab: STORAGE_TAB,
  };
}
