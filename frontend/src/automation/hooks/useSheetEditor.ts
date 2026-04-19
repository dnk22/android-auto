import { useEffect, useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getSheet, updateRow } from "../api/automation.api";
import { useAutomationStore } from "../store/automation.store";
import { useStore } from "../../store/useStore";
import { toNumberOrNull } from "../../utils/helper";
import type {
  SaveRowMutationInput,
  SheetEditorFormRow,
  SheetEditorFormValues,
} from "../../types/automation/editor.types";

const SHEET_QUERY_KEY = ["automation", "sheet", "editor"];

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
}): SheetEditorFormRow => ({
  ...row,
  status: row.status as SheetEditorFormRow["status"],
  hashtagInline: row.hashtagInline ?? "",
  meta: row.meta ?? "",
  startedAt: row.startedAt == null ? "" : String(row.startedAt),
  finishedAt: row.finishedAt == null ? "" : String(row.finishedAt),
});

export function useSheetEditor() {
  const queryClient = useQueryClient();
  const setSheet = useAutomationStore((state) => state.setSheet);
  const devices = useStore((state) => state.devices);

  const { register, control, reset, getValues } = useForm<SheetEditorFormValues>({
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

  useEffect(() => {
    if (!sheetQuery.data) {
      return;
    }
    setSheet(sheetQuery.data.rows);
    reset({ rows: sheetQuery.data.rows.map(toEditorFormRow) });
  }, [reset, setSheet, sheetQuery.data]);

  const saveRowMutation = useMutation({
    mutationFn: async ({ videoId, payload }: SaveRowMutationInput) => updateRow(videoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update row failed");
    },
  });

  const deviceOptions = useMemo(
    () =>
      (devices ?? [])
        .filter((device) => device.u2)
        .map((device) => device.id),
    [devices],
  );

  const saveRowAt = (index: number): void => {
    const row = fields[index];
    if (!row) {
      return;
    }

    const current = getValues(`rows.${index}`);
    saveRowMutation.mutate({
      videoId: row.videoId,
      payload: {
        deviceId: current.deviceId || "",
        products: current.products || "",
        hashtagInline: current.hashtagInline || "",
        status: current.status,
        meta: current.meta || "",
        version: Number(current.version || row.version),
        startedAt: toNumberOrNull(current.startedAt),
        finishedAt: toNumberOrNull(current.finishedAt),
      },
    });
  };

  return {
    register,
    fields,
    sheetQuery,
    deviceOptions,
    saveRowAt,
  };
}
