import { SessionToolbar } from "../../../automation/components/sessionToolbar";
import { SheetEditorTable } from "../../../automation/components/sheet-editor/SheetEditorTable";
import { useSheetEditor } from "../../../automation/hooks/useSheetEditor";

export default function DashboardSummarySection(): JSX.Element {
  const {
    register,
    control,
    fields,
    sheetQuery,
    isWatching,
    isSessionAutoReady,
    dirtyRowIndexes,
    deviceOptions,
    saveRowAt,
    setStatusByVideoId,
    deleteRowByVideoName,
  } =
    useSheetEditor();

  return (
    <section className="card fade-in flex h-full h-[50%] flex-col gap-4 overflow-hidden p-5">
      <SessionToolbar />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
        <SheetEditorTable
          fields={fields}
          register={register}
          control={control}
          deviceOptions={deviceOptions}
          isWatching={isWatching}
          isSessionAutoReady={isSessionAutoReady}
          dirtyRowIndexes={dirtyRowIndexes}
          onSaveRow={saveRowAt}
          onSetStatusByVideoId={setStatusByVideoId}
          onDeleteRowByVideoName={deleteRowByVideoName}
          loading={sheetQuery.isLoading}
        />

        {sheetQuery.error ? (
          <p className="text-xs text-red-600">Failed to load sheet data.</p>
        ) : null}
        {deviceOptions.length === 0 ? (
          <p className="text-xs text-amber-600">
            No connected device found for device_id selector.
          </p>
        ) : null}
      </div>
    </section>
  );
}
