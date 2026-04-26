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
  SheetActionButtonCell,
  SheetDeviceSelectCell,
  SheetMergedInfoTriggerCell,
  SheetStatusReadonlyCell,
  SheetProductsChipsInputCell,
  SheetTextInputCell,
} from "../components/sheet-editor/SheetEditorCells";
import { SHEET_EDITOR_COLUMN_LABELS } from "../utils/constants/sheetEditorTable.constants";
import type { SheetMergedInfoPayload } from "./useSheetMergedInfoModal";
import type { SheetStatus } from "../types/sheetStatus.types";

const columnHelper = createColumnHelper<SheetEditorFieldRow>();

interface UseSheetEditorTableParams {
  fields: SheetEditorFieldRow[];
  register: SheetEditorTableProps["register"];
  control: SheetEditorTableProps["control"];
  deviceOptions: string[];
  isSessionAutoReady: boolean;
  onSaveRow: (index: number) => void;
  onSetStatusByVideoId: (videoId: string, status: SheetStatus) => void;
  onDeleteRowByVideoName: (videoName: string) => void;
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
  isSessionAutoReady,
  onSaveRow,
  onSetStatusByVideoId,
  onDeleteRowByVideoName,
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
        cell: ({ row }) => {
          const isEditable = row.original.status === "idle";
          return (
          <SheetDeviceSelectCell
            rowIndex={row.index}
            deviceOptions={deviceOptions}
            control={control}
            isEditable={isEditable}
          />
        );
        },
      }),
      columnHelper.display({
        id: "products",
        header: SHEET_EDITOR_COLUMN_LABELS.products,
        ...withColumnLayout({ width: 300, maxWidth: 350 }),
        cell: ({ row }) => {
          const isEditable = row.original.status === "idle";
          return (
            <SheetProductsChipsInputCell
              rowIndex={row.index}
              control={control}
              isEditable={isEditable}
            />
          );
        },
      }),
      columnHelper.display({
        id: "hashtagInline",
        header: SHEET_EDITOR_COLUMN_LABELS.hashtagInline,
        ...withColumnLayout({ width: 120, maxWidth: 250 }),
        cell: ({ row }) => {
          const isEditable = row.original.status === "idle";
          return (
          <SheetTextInputCell
            rowIndex={row.index}
            field="hashtagInline"
            register={register}
            isEditable={isEditable}
          />
        );
        },
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
          <SheetActionButtonCell
            rowIndex={row.index}
            videoId={row.original.videoId}
            status={row.original.status}
            videoName={row.original.videoName}
            products={row.original.products}
            hashtagInline={row.original.hashtagInline}
            hashtagCommon={row.original.hashtagCommon}
            isSessionAutoReady={isSessionAutoReady}
            onSaveRow={onSaveRow}
            onSetStatusByVideoId={onSetStatusByVideoId}
            onDeleteRowByVideoName={onDeleteRowByVideoName}
          />
        ),
      }),
    ],
    [
      control,
      deviceOptions,
      isSessionAutoReady,
      onDeleteRowByVideoName,
      onOpenMergedInfo,
      onSaveRow,
      onSetStatusByVideoId,
      register,
    ],
  );

  return useReactTable({
    data: fields,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
}
