import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
  deleteFile,
  getStorage,
  renameFile,
} from "../api/automation.api";
import { useAutomationStore } from "../store/automation.store";
import type {
  DuplicateFileEvent,
  RenameFilePayload,
  SheetRow,
  StorageListResponse,
  StorageRowDeletedEvent,
  StorageRowRenamedEvent,
  StorageRowUpsertedEvent,
  StorageWsEvent,
} from "../types/automation.types";

const STORAGE_QUERY_KEY = ["automation", "storage"] as const;
const SHEET_QUERY_KEY = ["automation", "sheet"] as const;

function isDuplicateFileEvent(event: StorageWsEvent): event is DuplicateFileEvent {
  if (event.event !== "duplicate_file_detected") {
    return false;
  }

  const payload = event.payload as Record<string, unknown>;
  return typeof payload.originalName === "string" && typeof payload.renamedTo === "string";
}

function isStorageRowUpsertedEvent(event: StorageWsEvent): event is StorageRowUpsertedEvent {
  return event.event === "storage_row_upserted";
}

function isStorageRowRenamedEvent(event: StorageWsEvent): event is StorageRowRenamedEvent {
  return event.event === "storage_row_renamed";
}

function isStorageRowDeletedEvent(event: StorageWsEvent): event is StorageRowDeletedEvent {
  return event.event === "storage_row_deleted";
}

function upsertRow(rows: SheetRow[], nextRow: SheetRow): SheetRow[] {
  const existingIndex = rows.findIndex((row) => row.videoId === nextRow.videoId);
  if (existingIndex === -1) {
    return [nextRow, ...rows];
  }

  const copied = [...rows];
  copied[existingIndex] = nextRow;
  return copied;
}

function removeByVideoName(rows: SheetRow[], videoName: string): SheetRow[] {
  return rows.filter((row) => row.videoName !== videoName);
}

function applyStorageEventToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  event: StorageWsEvent,
): boolean {
  if (isStorageRowUpsertedEvent(event)) {
    const nextRow = event.payload.row;
    queryClient.setQueryData<StorageListResponse | undefined>(
      STORAGE_QUERY_KEY,
      (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          rows: upsertRow(current.rows, nextRow),
        };
      },
    );
    queryClient.setQueriesData(
      { queryKey: SHEET_QUERY_KEY },
      (current) => {
        if (!Array.isArray(current)) {
          return current;
        }
        return upsertRow(current as SheetRow[], nextRow);
      },
    );
    return true;
  }

  if (isStorageRowRenamedEvent(event)) {
    const maybeRow = event.payload.row;
    const oldName = event.payload.oldName;

    queryClient.setQueryData<StorageListResponse | undefined>(
      STORAGE_QUERY_KEY,
      (current) => {
        if (!current) {
          return current;
        }

        const removed = removeByVideoName(current.rows, oldName);
        if (!maybeRow) {
          return {
            ...current,
            rows: removed,
          };
        }

        return {
          ...current,
          rows: upsertRow(removed, maybeRow),
        };
      },
    );

    queryClient.setQueriesData(
      { queryKey: SHEET_QUERY_KEY },
      (current) => {
        if (!Array.isArray(current)) {
          return current;
        }
        const base = removeByVideoName(current as SheetRow[], oldName);
        if (!maybeRow) {
          return base;
        }
        return upsertRow(base, maybeRow);
      },
    );
    return true;
  }

  if (isStorageRowDeletedEvent(event)) {
    const videoName = event.payload.videoName;
    const maybeRow = event.payload.row;

    queryClient.setQueryData<StorageListResponse | undefined>(
      STORAGE_QUERY_KEY,
      (current) => {
        if (!current) {
          return current;
        }
        return {
          ...current,
          rows: removeByVideoName(current.rows, videoName),
        };
      },
    );

    queryClient.setQueriesData(
      { queryKey: SHEET_QUERY_KEY },
      (current) => {
        if (!Array.isArray(current)) {
          return current;
        }
        const base = removeByVideoName(current as SheetRow[], videoName);
        if (!maybeRow) {
          return base;
        }
        return upsertRow(base, maybeRow);
      },
    );
    return true;
  }

  return false;
}

export function useStorage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: STORAGE_QUERY_KEY,
    queryFn: getStorage,
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

  const renameMany = async (items: RenameFilePayload[]): Promise<void> => {
    for (const item of items) {
      await renameMutation.mutateAsync(item);
    }
  };

  const deleteMany = async (videoNames: string[]): Promise<void> => {
    for (const videoName of videoNames) {
      await deleteMutation.mutateAsync(videoName);
    }
  };

  return useMemo(
    () => ({
      rows: query.data?.rows ?? [],
      wsUrl: query.data?.wsUrl,
      videoFolderPath: query.data?.videoFolderPath,
      loading: query.isLoading,
      renameFile: renameMutation.mutateAsync,
      renameMany,
      deleteFile: deleteMutation.mutateAsync,
      deleteMany,
      isRenaming: renameMutation.isPending,
      isDeleting: deleteMutation.isPending,
    }),
    [
      query.data?.rows,
      query.data?.videoFolderPath,
      query.data?.wsUrl,
      query.isLoading,
      renameMutation.mutateAsync,
      deleteMutation.mutateAsync,
      deleteMany,
      renameMany,
      renameMutation.isPending,
      deleteMutation.isPending,
    ],
  );
}

export function useStorageEvents(wsUrl?: string): void {
  const queryClient = useQueryClient();
  const openDuplicateModalFromEvent = useAutomationStore((state) => state.openDuplicateModalFromEvent);

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let fallbackRefetchTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) {
        return;
      }

      socket = new WebSocket(wsUrl);

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as StorageWsEvent;
          if (isDuplicateFileEvent(event)) {
            openDuplicateModalFromEvent(event);
          }

          const handled = applyStorageEventToCache(queryClient, event);
          if (!handled) {
            if (fallbackRefetchTimer) {
              clearTimeout(fallbackRefetchTimer);
            }
            fallbackRefetchTimer = setTimeout(() => {
              void queryClient.invalidateQueries({ queryKey: STORAGE_QUERY_KEY });
              void queryClient.invalidateQueries({ queryKey: SHEET_QUERY_KEY });
            }, 350);
          }
        } catch {
          return;
        }
      };

      socket.onerror = () => {
        socket?.close();
      };

      socket.onclose = () => {
        if (stopped) {
          return;
        }
        reconnectTimer = setTimeout(() => {
          connect();
        }, 1000);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      if (fallbackRefetchTimer) {
        clearTimeout(fallbackRefetchTimer);
      }
      socket?.close();
      socket = null;
    };
  }, [openDuplicateModalFromEvent, queryClient, wsUrl]);
}
