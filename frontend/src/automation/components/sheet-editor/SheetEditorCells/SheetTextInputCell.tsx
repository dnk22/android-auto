import type { JSX } from "react";

import type { SheetEditorTableProps } from "../../../../types/automation/editor.types";

interface SheetTextInputCellProps {
  rowIndex: number;
  field: "hashtagInline";
  register: SheetEditorTableProps["register"];
  isEditable: boolean;
}

export function SheetTextInputCell({
  rowIndex,
  field,
  register,
  isEditable,
}: SheetTextInputCellProps): JSX.Element {
  return (
    <input
      disabled={!isEditable}
      className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 disabled:cursor-not-allowed disabled:opacity-60"
      {...register(`rows.${rowIndex}.${field}` as const)}
    />
  );
}
