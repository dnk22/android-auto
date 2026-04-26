import { useSheetEditorTable } from "../../hooks/useSheetEditorTable";
import { useSheetMergedInfoModal } from "../../hooks/useSheetMergedInfoModal";
import { SheetEditorTableBody } from "./SheetEditorTableBody";
import { SheetEditorTableHeader } from "./SheetEditorTableHeader";
import { SheetMergedInfoModal } from "./SheetMergedInfoModal";
import type { SheetEditorTableProps } from "../../../types/automation/editor.types";

type ColumnLayoutMeta = {
  width?: number | "auto";
  minWidth?: number;
  maxWidth?: number;
};

export function SheetEditorTable({
  fields,
  register,
  control,
  deviceOptions,
  isSessionAutoReady,
  onSaveRow,
  onSetStatusByVideoId,
  onDeleteRowByVideoName,
  loading,
}: SheetEditorTableProps): JSX.Element {
  const { selectedInfo, openMergedInfoModal, closeMergedInfoModal } = useSheetMergedInfoModal();

  const table = useSheetEditorTable({
    fields,
    register,
    control,
    deviceOptions,
    isSessionAutoReady,
    onSaveRow,
    onSetStatusByVideoId,
    onDeleteRowByVideoName,
    onOpenMergedInfo: openMergedInfoModal,
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const tableMinWidth = visibleColumns.reduce((sum, column) => {
    const layout = column.columnDef.meta as ColumnLayoutMeta | undefined;
    if (typeof layout?.width === "number") {
      return sum + layout.width;
    }
    if (typeof layout?.minWidth === "number") {
      return sum + layout.minWidth;
    }
    return sum + column.getSize();
  }, 0);

  return (
    <>
      <div className="rounded-xl h-full border border-[var(--card-border)] bg-[var(--panel-soft)] p-2">
        {loading ? (
          <div className="p-4 text-sm text-[var(--muted)]">Loading ...</div>
        ) : (
          <div className="h-full overflow-auto">
            <table
              className="w-max min-w-full table-fixed border-collapse"
              style={{ minWidth: tableMinWidth }}
            >
              <colgroup>
                {visibleColumns.map((column) => {
                  const layout = column.columnDef.meta as ColumnLayoutMeta | undefined;
                  return <col key={column.id} style={layout} />;
                })}
              </colgroup>
              <SheetEditorTableHeader table={table} />
              <SheetEditorTableBody table={table} />
            </table>
          </div>
        )}
      </div>

      <SheetMergedInfoModal
        info={selectedInfo}
        onClose={closeMergedInfoModal}
      />
    </>
  );
}
