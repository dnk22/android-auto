import type { Control, FieldArrayWithId, UseFormRegister } from "react-hook-form";
import type {
  SheetRow,
  UpdateRowPayload,
} from "../../automation/types/automation.types";
import type { SheetStatus } from "../../automation/types/sheetStatus.types";

export interface SheetEditorFormRow
  extends Omit<SheetRow, "deviceId" | "products" | "hashtagInline" | "meta" | "startedAt" | "finishedAt"> {
  deviceId: string[];
  products: string[];
  hashtagInline: string;
  meta: string;
  startedAt: string;
  finishedAt: string;
}

export interface SheetEditorFormValues {
  rows: SheetEditorFormRow[];
}

export type SheetEditorFieldRow = FieldArrayWithId<
  SheetEditorFormValues,
  "rows",
  "keyId"
>;

export type SessionToolbarAction = "watching" | "idle" | "toggle-auto-ready";

export interface SheetEditorTableProps {
  fields: SheetEditorFieldRow[];
  register: UseFormRegister<SheetEditorFormValues>;
  control: Control<SheetEditorFormValues>;
  deviceOptions: string[];
  isSessionAutoReady: boolean;
  onSaveRow: (index: number) => void;
  onSetStatusByVideoId: (videoId: string, status: SheetStatus) => void;
  onDeleteRowByVideoName: (videoName: string) => void;
  loading: boolean;
}

export interface SaveRowMutationInput {
  videoId: string;
  payload: UpdateRowPayload;
}
