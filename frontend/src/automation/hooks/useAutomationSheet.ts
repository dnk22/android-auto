import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { getSheet, setReady, updateRow } from "../api/automation.api";
import { useAutomationStore } from "../store/automation.store";
import type { SheetRow, UpdateRowPayload } from "../types/automation.types";
import { validateReadyRow } from "../utils/validators";

const SHEET_QUERY_KEY = ["automation", "sheet"] as const;

export function useAutomationSheet() {
  const queryClient = useQueryClient();
  const setSheet = useAutomationStore((state) => state.setSheet);
  const setConfig = useAutomationStore((state) => state.setConfig);
  const updateRowLocal = useAutomationStore((state) => state.updateRowLocal);
  const config = useAutomationStore((state) => state.config);

  const query = useQuery({
    queryKey: SHEET_QUERY_KEY,
    queryFn: getSheet,
    refetchInterval: (queryData) => {
      const rows = queryData.state.data?.rows ?? [];
      const hasRunning = rows.some((row) => row.status === "running" || row.status === "ready");
      return hasRunning ? 2000 : 8000;
    },
  });

  useEffect(() => {
    if (!query.data) {
      return;
    }
    setSheet(query.data.rows);
    setConfig(query.data.config);
  }, [query.data, setConfig, setSheet]);

  const updateRowMutation = useMutation({
    mutationFn: async (input: { videoId: string; payload: UpdateRowPayload }) => {
      await updateRow(input.videoId, input.payload);
    },
    onMutate: async ({ videoId, payload }) => {
      const snapshot = useAutomationStore.getState().sheet;
      updateRowLocal(videoId, payload as Partial<SheetRow>);
      return { snapshot };
    },
    onError: (_error, _input, context) => {
      if (context?.snapshot) {
        useAutomationStore.getState().setSheet(context.snapshot);
      }
      toast.error("Update row failed");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
  });

  const setReadyMutation = useMutation({
    mutationFn: async (row: SheetRow) => {
      const validationError = validateReadyRow(row, config);
      if (validationError) {
        throw new Error(validationError);
      }
      await setReady(row.videoId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Set ready failed");
    },
  });

  return useMemo(
    () => ({
      loading: query.isLoading,
      isRefetching: query.isRefetching,
      error: query.error,
      refetch: query.refetch,
      updateRow: updateRowMutation.mutateAsync,
      setReady: setReadyMutation.mutateAsync,
      isUpdating: updateRowMutation.isPending,
      isSettingReady: setReadyMutation.isPending,
    }),
    [
      query.isLoading,
      query.isRefetching,
      query.error,
      query.refetch,
      updateRowMutation.mutateAsync,
      setReadyMutation.mutateAsync,
      updateRowMutation.isPending,
      setReadyMutation.isPending,
    ],
  );
}
