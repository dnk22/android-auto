import { SessionToolbar } from "../../../automation/components/sheet-editor/SessionToolbar";
import { SheetEditorTable } from "../../../automation/components/sheet-editor/SheetEditorTable";
import { useSheetEditor } from "../../../automation/hooks/useSheetEditor";

export default function DashboardSummarySection(): JSX.Element {
  const {
    register,
    fields,
    sheetQuery,
    deviceOptions,
    saveRowAt,
  } = useSheetEditor();

  return (
    <section className="card fade-in flex min-h-[420px] flex-1 flex-col gap-4 p-5">
      <SessionToolbar />

      <SheetEditorTable
        fields={fields}
        register={register}
        deviceOptions={deviceOptions}
        onSaveRow={saveRowAt}
        loading={sheetQuery.isLoading}
      />

      {sheetQuery.error ? (
        <p className="text-xs text-red-600">Failed to load sheet data.</p>
      ) : null}
      {deviceOptions.length === 0 ? (
        <p className="text-xs text-amber-600">No connected device found for device_id selector.</p>
      ) : null}
    </section>
  );
}
