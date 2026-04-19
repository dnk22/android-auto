import { useSheetEditorTable } from "../../hooks/useSheetEditorTable";
import { useSheetMergedInfoModal } from "../../hooks/useSheetMergedInfoModal";
import { SheetEditorTableBody } from "./SheetEditorTableBody";
import { SheetEditorTableHeader } from "./SheetEditorTableHeader";
import { SheetMergedInfoModal } from "./SheetMergedInfoModal";
import type { SheetEditorTableProps } from "../../../types/automation/editor.types";

export function SheetEditorTable({
  fields,
  register,
  control,
  deviceOptions,
  onSaveRow,
  loading,
}: SheetEditorTableProps): JSX.Element {
  const { selectedInfo, openMergedInfoModal, closeMergedInfoModal } = useSheetMergedInfoModal();

  const table = useSheetEditorTable({
    fields,
    register,
    control,
    deviceOptions,
    onSaveRow,
    onOpenMergedInfo: openMergedInfoModal,
  });

  return (
    <>
      <div className="rounded-xl h-full border border-[var(--card-border)] bg-[var(--panel-soft)] p-2">
        {loading ? (
          <div className="p-4 text-sm text-[var(--muted)]">Loading ...</div>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-[1360px] w-full table-auto border-collapse">
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
