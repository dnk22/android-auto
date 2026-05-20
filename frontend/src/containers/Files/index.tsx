import { useEffect, useState } from "react";
import { FolderOpen } from "iconsax-reactjs";
import { toast } from "react-toastify";

import { DuplicateModal } from "../../automation/components/DuplicateModal";
import { VideoPreviewModal } from "../../automation/components/VideoPreviewModal";
import { buildStorageVideoUrl } from "../../automation/api/automation.api";
import { useStorage, useStorageEvents } from "../../automation/hooks/useStorage";
import { useAutomationStore } from "../../automation/store/automation.store";
import DebouncedButton from "../../components/common/DebouncedButton";
import FileItemCard from "./components/FileItemCard";
import { ConfirmDeleteModal } from "../../components/common/ConfirmDeleteModal";

export default function FilesContainer(): JSX.Element {
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [duplicateDraftName, setDuplicateDraftName] = useState("");
  const [previewVideoName, setPreviewVideoName] = useState<string | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string | null>(null);

  const {
    rows,
    videoFolderPath,
    loading,
    renameFile,
    deleteFile,
    openFolder,
    isDeleting,
    isRenaming,
    isOpeningFolder,
    wsUrl,
  } = useStorage();
  useStorageEvents(wsUrl);

  const duplicateModal = useAutomationStore((state) => state.duplicateModal);
  const closeDuplicateModal = useAutomationStore((state) => state.closeDuplicateModal);

  useEffect(() => {
    if (duplicateModal.isOpen) {
      setDuplicateDraftName("");
    }
  }, [duplicateModal.currentName, duplicateModal.isOpen]);

  useEffect(() => {
    if (!editingVideoId) {
      return;
    }
    const exists = rows.some((row) => row.videoId === editingVideoId);
    if (!exists) {
      setEditingVideoId(null);
      setEditingValue("");
    }
  }, [editingVideoId, rows]);

  const pending = isDeleting || isRenaming;
  const hasRows = rows.length > 0;
  const canOpenFolder = Boolean(videoFolderPath) && !isOpeningFolder;

  const startEdit = (videoId: string, videoName: string) => {
    setEditingVideoId(videoId);
    setEditingValue(videoName);
  };

  const cancelEdit = () => {
    setEditingVideoId(null);
    setEditingValue("");
  };

  const onRenameAction = (videoId: string, videoName: string) => {
    if (editingVideoId !== videoId) {
      startEdit(videoId, videoName);
      return;
    }

    const nextName = editingValue.trim();
    if (!nextName) {
      toast.error("Tên video là bắt buộc");
      return;
    }

    if (nextName === videoName) {
      cancelEdit();
      return;
    }

    void (async () => {
      try {
        await renameFile({ videoName, newName: nextName });
        cancelEdit();
      } catch {
        return;
      }
    })();
  };

  const onDelete = (videoName: string) => {
    setDeleteTargetName(videoName);
  };

  const onOpenPreview = (videoName: string) => {
    setPreviewVideoName(videoName);
  };

  const closePreview = () => {
    setPreviewVideoName(null);
  };

  const closeDeleteConfirm = () => {
    setDeleteTargetName(null);
  };

  const onOpenFolder = () => {
    if (!videoFolderPath) {
      toast.error("Chưa có folder được cấu hình");
      return;
    }
    void openFolder();
  };

  return (
    <div className="app-shell h-screen w-full overflow-hidden p-4">
      <div className="mx-auto flex h-full w-full min-h-0 flex-col gap-4">
        <div className="card fade-in flex items-center justify-between gap-3 p-5">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--ink)]">File Manager</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Folder: {videoFolderPath || "(chưa cấu hình)"}</p>
          </div>
          <DebouncedButton
            type="button"
            onClick={onOpenFolder}
            disabled={!canOpenFolder}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] px-4 text-sm font-semibold text-[var(--ink)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size="18" color="currentColor" variant="Linear" />
            Mở folder
          </DebouncedButton>
        </div>

        <section className="card fade-in min-h-0 flex-1 overflow-y-auto border border-[var(--card-border)] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.10)]">
          {!hasRows ? (
            <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] text-sm text-[var(--muted)]">
              Chưa có video trong folder hiện tại.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <FileItemCard
                  key={row.videoId}
                  row={row}
                  isEditing={editingVideoId === row.videoId}
                  editingValue={editingValue}
                  pending={pending}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onEditValueChange={setEditingValue}
                  onRenameAction={onRenameAction}
                  onDelete={onDelete}
                  onOpenPreview={onOpenPreview}
                />
              ))}
            </div>
          )}

          {loading ? <p className="mt-3 text-xs text-[var(--muted)]">Loading storage...</p> : null}
        </section>
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
              toast.error(error instanceof Error ? error.message : "Rename failed");
            }
          })();
        }}
      />

      <ConfirmDeleteModal
        isOpen={deleteTargetName !== null}
        videoName={deleteTargetName ?? ""}
        pending={isDeleting}
        onCancel={closeDeleteConfirm}
        onConfirm={() => {
          if (!deleteTargetName) {
            return;
          }
          void (async () => {
            try {
              await deleteFile(deleteTargetName);
              closeDeleteConfirm();
            } catch {
              return;
            }
          })();
        }}
      />

      <VideoPreviewModal
        isOpen={previewVideoName !== null}
        videoName={previewVideoName ?? ""}
        videoUrl={previewVideoName ? buildStorageVideoUrl(previewVideoName) : ""}
        onClose={closePreview}
      />
    </div>
  );
}
