import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { deleteFile, getStorage, renameFile, stopJob } from "../api/automation.api";
import { useAutomationStore } from "../store/automation.store";
import type { AutomationWsEvent, DuplicateFileEvent, RenameFilePayload, SheetStatus } from "../types/automation.types";

const STORAGE_QUERY_KEY = ["automation", "storage"] as const;
const SHEET_QUERY_KEY = ["automation", "sheet"] as const;

function isDuplicateFileEvent(event: AutomationWsEvent): event is DuplicateFileEvent {
  if (event.event !== "duplicate_file_detected") {
    return false;
  }

  const payload = event.payload as Record<string, unknown>;
  return typeof payload.originalName === "string" && typeof payload.renamedTo === "string";
}

function resolveAutomationWsUrl(): string {
  const envUrl = import.meta.env.VITE_AUTOMATION_WS_URL as string | undefined;
  if (envUrl && envUrl.trim()) {
    return envUrl;
  }

  const backendUrl = (import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || "http://localhost:8000") as string;
  const wsBase = backendUrl.replace(/^http/i, "ws").replace(/\/$/, "");
  return `${wsBase}/ws/automation/events`;
}

export function useStorage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STORAGE_QUERY_KEY,
    queryFn: getStorage,
    refetchInterval: 10000,
  });

  const renameMutation = useMutation({
    mutationFn: async (payload: RenameFilePayload) => {
      await renameFile(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Rename file failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoName: string) => {
      await deleteFile(videoName);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete file failed");
    },
  });

  const deleteWithPolicy = async (input: {
    videoName: string;
    rowStatus?: SheetStatus;
    jobId?: string;
  }): Promise<void> => {
    if (input.rowStatus === "ready") {
      throw new Error("Cannot delete file when status is ready.");
    }

    if (input.rowStatus === "running") {
      const confirmed = window.confirm("Job is running. Stop job and delete file?");
      if (!confirmed) {
        return;
      }
      if (!input.jobId) {
        throw new Error("Missing jobId for running row.");
      }
      await stopJob(input.jobId);
    }

    await deleteMutation.mutateAsync(input.videoName);
  };

  return useMemo(
    () => ({
      files: query.data?.files ?? [],
      loading: query.isLoading,
      refetch: query.refetch,
      renameFile: renameMutation.mutateAsync,
      deleteFile: deleteMutation.mutateAsync,
      deleteWithPolicy,
      isRenaming: renameMutation.isPending,
      isDeleting: deleteMutation.isPending,
    }),
    [
      query.data?.files,
      query.isLoading,
      query.refetch,
      renameMutation.mutateAsync,
      deleteMutation.mutateAsync,
      deleteWithPolicy,
      renameMutation.isPending,
      deleteMutation.isPending,
    ],
  );
}

export function useStorageEvents(): void {
  const queryClient = useQueryClient();
  const openDuplicateModalFromEvent = useAutomationStore((state) => state.openDuplicateModalFromEvent);

  useEffect(() => {
    const wsUrl = resolveAutomationWsUrl();
    let socket: WebSocket | null = new WebSocket(wsUrl);

    socket.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as AutomationWsEvent;
        if (isDuplicateFileEvent(event)) {
          openDuplicateModalFromEvent(event);
          void queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
          void queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
        }
      } catch {
        return;
      }
    };

    socket.onerror = () => {
      socket?.close();
    };

    return () => {
      socket?.close();
      socket = null;
    };
  }, [openDuplicateModalFromEvent, queryClient]);
}
