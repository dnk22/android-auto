import type { JSX } from "react";

import type { SheetEditorTableProps } from "../../../../types/automation/editor.types";

interface SheetTextInputCellProps {
  rowIndex: number;
  field: "hashtagInline";
  register: SheetEditorTableProps["register"];
}

export function SheetTextInputCell({
  rowIndex,
  field,
  register,
}: SheetTextInputCellProps): JSX.Element {
  return (
    <input
      className="h-10 w-full rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2"
      {...register(`rows.${rowIndex}.${field}` as const)}
    />
  );
}
