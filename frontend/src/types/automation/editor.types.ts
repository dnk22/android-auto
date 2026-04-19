import type { FieldArrayWithId, UseFormRegister } from "react-hook-form";
import type {
  SheetRow,
  UpdateRowPayload,
} from "../../automation/types/automation.types";

export interface SheetEditorFormRow
  extends Omit<SheetRow, "hashtagInline" | "meta" | "startedAt" | "finishedAt"> {
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
  deviceOptions: string[];
  onSaveRow: (index: number) => void;
  loading: boolean;
}

export interface SaveRowMutationInput {
  videoId: string;
  payload: UpdateRowPayload;
}
