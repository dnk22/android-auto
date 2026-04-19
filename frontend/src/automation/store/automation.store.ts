import { create } from "zustand";

import type { DuplicateFileEvent, SheetConfig, SheetRow } from "../types/automation.types";

export type DuplicateModalState = {
  isOpen: boolean;
  originalName: string;
  currentName: string;
};

type AutomationStoreState = {
  sheet: SheetRow[];
  config: SheetConfig;
  selectedRowId?: string;
  duplicateModal: DuplicateModalState;

  setSheet: (rows: SheetRow[]) => void;
  setConfig: (config: SheetConfig) => void;
  setSelectedRowId: (rowId?: string) => void;
  updateRowLocal: (videoId: string, patch: Partial<SheetRow>) => void;
  openDuplicateModalFromEvent: (event: DuplicateFileEvent) => void;
  closeDuplicateModal: () => void;
};

const defaultConfig: SheetConfig = {
  autoReady: false,
  hashtagCommon: undefined,
};

const defaultDuplicateModal: DuplicateModalState = {
  isOpen: false,
  originalName: "",
  currentName: "",
};

export const useAutomationStore = create<AutomationStoreState>((set) => ({
  sheet: [],
  config: defaultConfig,
  selectedRowId: undefined,
  duplicateModal: defaultDuplicateModal,

  setSheet: (sheet) =>
    set((state) => ({
      sheet,
      selectedRowId: state.selectedRowId && sheet.some((row) => row.videoId === state.selectedRowId)
        ? state.selectedRowId
        : undefined,
    })),

  setConfig: (config) => set({ config }),
  setSelectedRowId: (selectedRowId) => set({ selectedRowId }),

  updateRowLocal: (videoId, patch) =>
    set((state) => ({
      sheet: state.sheet.map((row) => (row.videoId === videoId ? { ...row, ...patch } : row)),
    })),

  openDuplicateModalFromEvent: (event) =>
    set({
      duplicateModal: {
        isOpen: true,
        originalName: event.payload.originalName,
        currentName: event.payload.renamedTo,
      },
    }),

  closeDuplicateModal: () =>
    set({
      duplicateModal: defaultDuplicateModal,
    }),
}));
