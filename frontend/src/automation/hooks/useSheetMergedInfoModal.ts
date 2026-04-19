import { useCallback, useState } from "react";

export interface SheetMergedInfoPayload {
  videoName: string;
  meta: string;
  startedAt: string;
  finishedAt: string;
}

export function useSheetMergedInfoModal() {
  const [selectedInfo, setSelectedInfo] = useState<SheetMergedInfoPayload | null>(null);

  const openMergedInfoModal = useCallback((payload: SheetMergedInfoPayload) => {
    setSelectedInfo(payload);
  }, []);

  const closeMergedInfoModal = useCallback(() => {
    setSelectedInfo(null);
  }, []);

  return {
    selectedInfo,
    openMergedInfoModal,
    closeMergedInfoModal,
  };
}
