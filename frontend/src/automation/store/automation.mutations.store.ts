import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import { createVideoFolder, updateRow, updateSession } from "../api/automation.api";
import type { SaveRowMutationInput } from "../../types/automation/editor.types";
import type { CreateVideoFolderPayload } from "../types/automation.types";

export const SHEET_QUERY_KEY = ["automation", "sheet", "editor"];
export const SESSION_QUERY_KEY = ["automation", "session"];

export function useSaveSheetRowMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ videoId, payload }: SaveRowMutationInput) =>
      updateRow(videoId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Update row failed");
    },
  });
}

export function useSessionActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Session action failed");
    },
  });
}

export function useCreateVideoFolderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateVideoFolderPayload) => createVideoFolder(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Create video folder failed");
    },
  });
}
