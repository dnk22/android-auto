import { useMemo } from "react";
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import type {
  SheetEditorFieldRow,
  SheetEditorTableProps,
} from "../../types/automation/editor.types";
import {
  SheetDeviceSelectCell,
  SheetMergedInfoTriggerCell,
  SheetSaveButtonCell,
  SheetStatusReadonlyCell,
  SheetProductsChipsInputCell,
  SheetTextInputCell,
} from "../components/sheet-editor/SheetEditorCells";
import { SHEET_EDITOR_COLUMN_LABELS } from "../utils/constants/sheetEditorTable.constants";
import type { SheetMergedInfoPayload } from "./useSheetMergedInfoModal";

const columnHelper = createColumnHelper<SheetEditorFieldRow>();

interface UseSheetEditorTableParams {
  fields: SheetEditorFieldRow[];
  register: SheetEditorTableProps["register"];
  control: SheetEditorTableProps["control"];
  deviceOptions: string[];
  onSaveRow: (index: number) => void;
  onOpenMergedInfo: (payload: SheetMergedInfoPayload) => void;
}

type ColumnLayoutMeta = {
  width?: number | "auto";
  minWidth?: number;
  maxWidth?: number;
};

export function useSheetEditorTable({
  fields,
  register,
  control,
  deviceOptions,
  onSaveRow,
  onOpenMergedInfo,
}: UseSheetEditorTableParams) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("videoName", {
        id: "videoName",
        header: SHEET_EDITOR_COLUMN_LABELS.videoName,
        meta: { width: 100, maxWidth: 200 } as ColumnLayoutMeta,
        cell: (info) => (
          <div className="truncate text-[var(--ink)]">{info.getValue()}</div>
        ),
      }),
      columnHelper.display({
        id: "deviceId",
        header: SHEET_EDITOR_COLUMN_LABELS.deviceId,
        meta: { width: 80, maxWidth: 200 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetDeviceSelectCell
            rowIndex={row.index}
            deviceOptions={deviceOptions}
            control={control}
          />
        ),
      }),
      columnHelper.display({
        id: "products",
        header: SHEET_EDITOR_COLUMN_LABELS.products,
        meta: { width: 200, maxWidth: 260 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetProductsChipsInputCell rowIndex={row.index} control={control} />
        ),
      }),
      columnHelper.display({
        id: "hashtagInline",
        header: SHEET_EDITOR_COLUMN_LABELS.hashtagInline,
        meta: { width: 100, maxWidth: 200 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetTextInputCell
            rowIndex={row.index}
            field="hashtagInline"
            register={register}
          />
        ),
      }),
      columnHelper.display({
        id: "status",
        header: SHEET_EDITOR_COLUMN_LABELS.status,
        meta: { width: 100, minWidth: 140 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetStatusReadonlyCell status={row.original.status} />
        ),
      }),
      columnHelper.display({
        id: "details",
        header: SHEET_EDITOR_COLUMN_LABELS.details,
        meta: { width: 100 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetMergedInfoTriggerCell
            payload={{
              videoName: row.original.videoName,
              meta: row.original.meta,
              startedAt: row.original.startedAt,
              finishedAt: row.original.finishedAt,
            }}
            onOpen={onOpenMergedInfo}
          />
        ),
      }),
      columnHelper.display({
        id: "action",
        header: SHEET_EDITOR_COLUMN_LABELS.action,
        meta: { width: 100 } as ColumnLayoutMeta,
        cell: ({ row }) => (
          <SheetSaveButtonCell rowIndex={row.index} onSaveRow={onSaveRow} />
        ),
      }),
    ],
    [control, deviceOptions, onOpenMergedInfo, onSaveRow, register],
  );

  return useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
}
