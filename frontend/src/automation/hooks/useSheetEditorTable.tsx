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

function withColumnLayout(layout: ColumnLayoutMeta) {
  return {
    size: typeof layout.width === "number" ? layout.width : undefined,
    minSize: layout.minWidth,
    maxSize: layout.maxWidth,
    meta: layout as ColumnLayoutMeta,
  };
}

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
        ...withColumnLayout({ width: 200, maxWidth: 200 }),
        cell: (info) => (
          <div className="truncate text-[var(--ink)]">{info.getValue()}</div>
        ),
      }),
      columnHelper.display({
        id: "deviceId",
        header: SHEET_EDITOR_COLUMN_LABELS.deviceId,
        ...withColumnLayout({ width: 100, maxWidth: 200 }),
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
        ...withColumnLayout({ width: 300, maxWidth: 350 }),
        cell: ({ row }) => (
          <SheetProductsChipsInputCell rowIndex={row.index} control={control} />
        ),
      }),
      columnHelper.display({
        id: "hashtagInline",
        header: SHEET_EDITOR_COLUMN_LABELS.hashtagInline,
        ...withColumnLayout({ width: 120, maxWidth: 250 }),
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
        ...withColumnLayout({ width: 100, minWidth: 140 }),
        cell: ({ row }) => (
          <SheetStatusReadonlyCell status={row.original.status} />
        ),
      }),
      columnHelper.display({
        id: "details",
        header: SHEET_EDITOR_COLUMN_LABELS.details,
        ...withColumnLayout({ width: 100 }),
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
        ...withColumnLayout({ width: 100 }),
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
