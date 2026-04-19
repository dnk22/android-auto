import { flexRender, type Table } from "@tanstack/react-table";

import type { SheetEditorFieldRow } from "../../../types/automation/editor.types";

interface SheetEditorTableBodyProps {
  table: Table<SheetEditorFieldRow>;
}

export function SheetEditorTableBody({ table }: SheetEditorTableBodyProps): JSX.Element {
  return (
    <tbody>
      {table.getRowModel().rows.map((row) => (
        <tr key={row.id} className="border-b border-[var(--card-border)] align-top text-xs">
          {row.getVisibleCells().map((cell) => {
            const layout = cell.column.columnDef.meta as
              | { width?: number | string; minWidth?: number; maxWidth?: number }
              | undefined;

            return (
              <td
                key={cell.id}
                style={layout}
                className={`px-3 py-3 whitespace-nowrap ${
                  cell.column.id === "action"
                    ? "sticky right-0 z-10 bg-[var(--panel-soft)] shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.45)]"
                    : ""
                }`}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );
}
