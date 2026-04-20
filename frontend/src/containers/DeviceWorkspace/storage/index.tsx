import { useEffect, useState } from "react";
import { toast } from "react-toastify";

import { DuplicateModal } from "../../../automation/components/DuplicateModal";
import {
  useStorage,
  useStorageEvents,
} from "../../../automation/hooks/useStorage";
import { useAutomationStore } from "../../../automation/store/automation.store";

export default function StorageSectionContainer(): JSX.Element {
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [duplicateDraftName, setDuplicateDraftName] = useState("");

  const {
    rows,
    wsUrl,
    videoFolderPath,
    loading,
    renameFile,
    deleteFile,
    isDeleting,
    isRenaming,
  } = useStorage();
  const duplicateModal = useAutomationStore((state) => state.duplicateModal);
  const closeDuplicateModal = useAutomationStore(
    (state) => state.closeDuplicateModal,
  );

  useStorageEvents(wsUrl);

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
        await renameFile({
          videoName,
          newName: nextName,
        });
        cancelEdit();
      } catch {
        return;
      }
    })();
  };

  const onDelete = (videoName: string) => {
    void deleteFile(videoName);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Storage
        </h2>
        <p className="text-[11px] text-[var(--muted)]">
          Folder: {videoFolderPath || "(chưa cấu hình)"}
        </p>
      </div>

      {!hasRows ? (
        <div className="mb-3 h-full rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-3 text-center text-xs text-[var(--muted)]">
          Chưa có video trong folder hiện tại.
        </div>
      ) : null}

      {hasRows ? (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.videoId}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-3"
              >
                {editingVideoId === row.videoId ? (
                  <input
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEdit();
                        return;
                      }
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onRenameAction(row.videoId, row.videoName);
                      }
                    }}
                    placeholder="video_name.mp4"
                    autoFocus
                    className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--panel)] px-2 py-1 text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent-2)] focus:ring-1 focus:ring-[var(--accent-2)]"
                  />
                ) : (
                  <button
                    type="button"
                    onDoubleClick={() => startEdit(row.videoId, row.videoName)}
                    className="w-full truncate text-left text-sm font-semibold text-[var(--ink)]"
                    title="Double click để đổi tên"
                  >
                    {row.videoName}
                  </button>
                )}
                <div className="mt-1 text-[11px] text-[var(--muted)]">status: {row.status}</div>

                <div className="mt-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => onRenameAction(row.videoId, row.videoName)}
                    disabled={pending}
                    className="flex-1 rounded-lg border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--ink)] disabled:opacity-50"
                  >
                    {editingVideoId === row.videoId ? "Lưu" : "Đổi tên"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row.videoName)}
                    disabled={pending}
                    className="flex-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

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

      {loading ? (
        <p className="mt-3 text-xs text-[var(--muted)]">Loading storage...</p>
      ) : null}
    </>
  );
}
