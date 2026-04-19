import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "react-toastify";

import { DuplicateModal } from "../../../automation/components/DuplicateModal";
import {
  useStorage,
  useStorageEvents,
} from "../../../automation/hooks/useStorage";
import { useAutomationStore } from "../../../automation/store/automation.store";
import type { SheetStatus } from "../../../automation/types/automation.types";

type StorageRowInfo = {
  status?: SheetStatus;
  jobId?: string;
};

export default function StorageSectionContainer(): JSX.Element {
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [duplicateDraftName, setDuplicateDraftName] = useState("");

  const {
    files,
    loading,
    refetch,
    renameFile,
    deleteWithPolicy,
    isDeleting,
    isRenaming,
  } = useStorage();
  const sheet = useAutomationStore((state) => state.sheet);
  const duplicateModal = useAutomationStore((state) => state.duplicateModal);
  const closeDuplicateModal = useAutomationStore(
    (state) => state.closeDuplicateModal,
  );

  useStorageEvents();

  useEffect(() => {
    if (duplicateModal.isOpen) {
      setDuplicateDraftName("");
    }
  }, [duplicateModal.currentName, duplicateModal.isOpen]);

  const rowInfoByName = useMemo<Record<string, StorageRowInfo>>(() => {
    const info: Record<string, StorageRowInfo> = {};
    for (const row of sheet) {
      let jobId: string | undefined;
      if (typeof row.meta === "string" && row.meta.trim()) {
        try {
          const parsed = JSON.parse(row.meta);
          if (parsed && typeof parsed === "object" && typeof parsed.jobId === "string") {
            jobId = parsed.jobId;
          }
        } catch {
          jobId = undefined;
        }
      }

      info[row.videoName] = {
        status: row.status,
        jobId,
      };
    }
    return info;
  }, [sheet]);

  const onDrop = (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) {
      return;
    }
    toast.info(
      "Backend chưa có endpoint upload. Hãy copy file vào folder storage trên server, rồi bấm Reload.",
    );
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  const pending = isDeleting || isRenaming;

  const dropzoneRootProps = getRootProps();
  const dropzoneInputProps = getInputProps();

  const onRenameDraftChange = (videoName: string, value: string) => {
    setRenameDraft((state) => ({
      ...state,
      [videoName]: value,
    }));
  };
  const onRename = (videoName: string) => {
    void renameFile({
      videoName,
      newName: renameDraft[videoName] || undefined,
    });
  };
  const onDelete = (videoName: string) => {
    const row = rowInfoByName[videoName];
    void (async () => {
      try {
        await deleteWithPolicy({
          videoName,
          rowStatus: row?.status,
          jobId: row?.jobId,
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Delete file failed",
        );
      }
    })();
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Storage
        </h2>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--ink)]"
        >
          Reload
        </button>
      </div>

      <div
        {...dropzoneRootProps}
        className={`mb-3 h-full cursor-pointer rounded-xl border border-dashed p-3 text-center text-xs ${
          isDragActive
            ? "border-[var(--accent-2)] bg-blue-50"
            : "border-[var(--card-border)] bg-[var(--panel-soft)]"
        }`}
      >
        <input {...dropzoneInputProps} />
        Drag & drop files here. (Or click to select files) <br />
      </div>

      <DuplicateModal
        isOpen={duplicateModal.isOpen}
        originalName={duplicateModal.originalName}
        currentName={duplicateModal.currentName}
        draftName={duplicateDraftName}
        onDraftNameChange={setDuplicateDraftName}
        onCancel={() => {
          closeDuplicateModal();
          setDuplicateDraftName("");
        }}
        onConfirm={() => {
          void (async () => {
            try {
              await renameFile({
                videoName: duplicateModal.currentName,
                newName: duplicateDraftName || undefined,
              });
              closeDuplicateModal();
              setDuplicateDraftName("");
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : "Rename failed",
              );
            }
          })();
        }}
      />
    </>
  );
}
