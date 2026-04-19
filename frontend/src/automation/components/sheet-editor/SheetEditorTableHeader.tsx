import { flexRender, type Table } from "@tanstack/react-table";

import type { SheetEditorFieldRow } from "../../../types/automation/editor.types";

interface SheetEditorTableHeaderProps {
  table: Table<SheetEditorFieldRow>;
}

export function SheetEditorTableHeader({ table }: SheetEditorTableHeaderProps): JSX.Element {
  return (
    <thead>
      {table.getHeaderGroups().map((headerGroup) => (
        <tr key={headerGroup.id} className="border-b border-[var(--card-border)]">
          {headerGroup.headers.map((header) => {
            const layout = header.column.columnDef.meta as
              | { width?: number | string; minWidth?: number; maxWidth?: number }
              | undefined;

            return (
              <th
                key={header.id}
                style={layout}
                className={`px-3 py-3 text-left text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] whitespace-nowrap ${
                  header.column.id === "action"
                    ? "sticky right-0 z-20 bg-[var(--panel-soft)] shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.45)]"
                    : ""
                }`}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            );
          })}
        </tr>
      ))}
    </thead>
  );
}
