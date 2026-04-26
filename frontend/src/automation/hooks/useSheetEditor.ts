import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";

import { getSession, getSheet } from "../api/automation.api";
import {
  SESSION_QUERY_KEY,
  SHEET_QUERY_KEY,
  useDeleteSheetRowByVideoNameMutation,
  useDeleteStorageVideoMutation,
  useSaveSheetRowMutation,
  useSetSheetRowStatusMutation,
} from "../store/automation.mutations.store";
import { useAutomationStore } from "../store/automation.store";
import { useStore } from "../../store/useStore";
import { toNumberOrNull } from "../../utils/helper";
import type {
  SheetEditorFormRow,
  SheetEditorFormValues,
} from "../../types/automation/editor.types";
import type { SheetStatus } from "../types/sheetStatus.types";

const toEditorFormRow = (row: {
  id: string;
  videoId: string;
  videoName: string;
  deviceId: string;
  products: string;
  hashtagInline?: string;
  createdByDuplicate: boolean;
  status: string;
  meta?: string | null;
  version: number;
  startedAt?: number | null;
  finishedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}): SheetEditorFormRow => {
  const parsedDeviceIds = row.deviceId
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const parsedProducts = row.products
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    ...row,
    deviceId: parsedDeviceIds.length > 0 ? parsedDeviceIds : ["all"],
    products: parsedProducts,
    status: row.status as SheetEditorFormRow["status"],
    hashtagInline: row.hashtagInline ?? "",
    meta: row.meta ?? "",
    startedAt: row.startedAt == null ? "" : String(row.startedAt),
    finishedAt: row.finishedAt == null ? "" : String(row.finishedAt),
  };
};

export function useSheetEditor() {
  const setSheet = useAutomationStore((state) => state.setSheet);
  const devices = useStore((state) => state.devices);
  const saveRowMutation = useSaveSheetRowMutation();
  const deleteRowMutation = useDeleteSheetRowByVideoNameMutation();
  const deleteStorageVideoMutation = useDeleteStorageVideoMutation();
  const setStatusMutation = useSetSheetRowStatusMutation();

  const { register, control, reset, getValues, formState } =
    useForm<SheetEditorFormValues>({
      defaultValues: {
        rows: [],
      },
    });

  const { fields } = useFieldArray({
    control,
    name: "rows",
    keyName: "keyId",
  });

  const sheetQuery = useQuery({
    queryKey: SHEET_QUERY_KEY,
    queryFn: getSheet,
  });
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
  });

  const deviceOptions = useMemo(
    () =>
      (devices ?? [])
        .filter((device) => device.u2)
        .map((device) => device.id),
    [devices],
  );

  useEffect(() => {
    if (!sheetQuery.data) {
      return;
    }
    setSheet(sheetQuery.data);
    reset({ rows: sheetQuery.data.map(toEditorFormRow) });
  }, [reset, setSheet, sheetQuery.data]);

  const saveRowAt = (index: number): void => {
    const row = fields[index];
    if (!row) {
      return;
    }

    const current = getValues(`rows.${index}`);
    const selectedDeviceIds = Array.isArray(current.deviceId)
      ? current.deviceId
      : [];
    const hasAllSelected =
      selectedDeviceIds.length === 0 || selectedDeviceIds.includes("all");
    const resolvedDeviceIds = hasAllSelected
      ? ["all"]
      : selectedDeviceIds.filter((value) => value && value !== "all");
    const deviceIdCsv = Array.from(new Set(resolvedDeviceIds)).join(",");
    const productCsv = Array.from(
      new Set(
        (current.products ?? []).map((value) => value.trim()).filter(Boolean),
      ),
    ).join(",");

    saveRowMutation.mutate({
      videoId: row.videoId,
      payload: {
        deviceId: deviceIdCsv,
        products: productCsv,
        hashtagInline: current.hashtagInline || "",
        status: current.status,
        meta: current.meta || "",
        version: Number(current.version || row.version),
        startedAt: toNumberOrNull(current.startedAt),
        finishedAt: toNumberOrNull(current.finishedAt),
      },
    });
  };

  const setStatusByVideoId = (videoId: string, status: SheetStatus): void => {
    if (!videoId) {
      return;
    }
    setStatusMutation.mutate({ videoId, status });
  };

  const deleteRowAndVideoByVideoName = (videoName: string): void => {
    if (!videoName) {
      return;
    }

    void (async () => {
      try {
        await deleteRowMutation.mutateAsync(videoName);
        await deleteStorageVideoMutation.mutateAsync({
          videoName,
          skipUpdateSheetStatus: true,
        });
      } catch {
        return;
      }
    })();
  };

  const dirtyRowIndexes = useMemo(() => {
    const rowsDirty = formState.dirtyFields?.rows;
    if (!Array.isArray(rowsDirty)) {
      return new Set<number>();
    }

    const dirty = new Set<number>();
    rowsDirty.forEach((row, index) => {
      if (!row) {
        return;
      }
      if (typeof row !== "object" || Object.keys(row).length > 0) {
        dirty.add(index);
      }
    });
    return dirty;
  }, [formState.dirtyFields?.rows]);

  return {
    register,
    control,
    fields,
    sheetQuery,
    sessionQuery,
    deviceOptions,
    isWatching: sessionQuery.data?.status === "watching",
    isSessionAutoReady: Boolean(sessionQuery.data?.autoReady),
    dirtyRowIndexes,
    saveRowAt,
    setStatusByVideoId,
    deleteRowByVideoName: deleteRowAndVideoByVideoName,
  };
}
