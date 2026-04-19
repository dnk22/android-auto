import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { stopJob } from "../api/automation.api";
import type { SheetRow } from "../types/automation.types";

const SHEET_QUERY_KEY = ["automation", "sheet"] as const;

export function useJob() {
  const queryClient = useQueryClient();

  const stopMutation = useMutation({
    mutationFn: async (jobId: string) => {
      await stopJob(jobId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Stop job failed");
    },
  });

  return useMemo(
    () => ({
      stopJob: stopMutation.mutateAsync,
      stopByRow: async (row: SheetRow) => {
        const jobId = typeof row.meta?.jobId === "string" ? row.meta.jobId : "";
        if (!jobId) {
          throw new Error("Missing jobId on running row");
        }
        await stopMutation.mutateAsync(jobId);
      },
      isStopping: stopMutation.isPending,
    }),
    [stopMutation.mutateAsync, stopMutation.isPending],
  );
}
