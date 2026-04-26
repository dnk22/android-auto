import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
  createVideoFolder,
  deleteFile,
  deleteSheetByVideoName,
  updateSheetStatus,
  updateRow,
  updateSession,
} from "../api/automation.api";
import type { SaveRowMutationInput } from "../../types/automation/editor.types";
import type { CreateVideoFolderPayload } from "../types/automation.types";
import type { SheetStatus } from "../types/sheetStatus.types";

export const SHEET_QUERY_KEY = ["automation", "sheet", "editor"];
export const SESSION_QUERY_KEY = ["automation", "session"];
export const STORAGE_QUERY_KEY = ["automation", "storage"];

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

export function useDeleteSheetRowByVideoNameMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (videoName: string) => deleteSheetByVideoName(videoName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete row failed");
    },
  });
}

export function useDeleteStorageVideoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      videoName: string;
      skipUpdateSheetStatus?: boolean;
    }) =>
      deleteFile(input.videoName, {
        skipUpdateSheetStatus: input.skipUpdateSheetStatus,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Delete video failed");
    },
  });
}

export function useSetSheetRowStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { videoId: string; status: SheetStatus }) =>
      updateSheetStatus(input.videoId, input.status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Set ready failed");
    },
  });
}

export function useSessionActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSession,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
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
