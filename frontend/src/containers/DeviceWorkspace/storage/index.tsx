import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import { DuplicateModal } from "../../../automation/components/DuplicateModal";
import {
  useStorage,
  useStorageEvents,
} from "../../../automation/hooks/useStorage";
import { useAutomationStore } from "../../../automation/store/automation.store";
import type { RenameFilePayload } from "../../../automation/types/automation.types";

export default function StorageSectionContainer(): JSX.Element {
  const [renameDraft, setRenameDraft] = useState<Record<string, string>>({});
  const [duplicateDraftName, setDuplicateDraftName] = useState("");
  const [selectedVideos, setSelectedVideos] = useState<Record<string, boolean>>({});
  const [bulkPrefix, setBulkPrefix] = useState("");

  const {
    rows,
    wsUrl,
    videoFolderPath,
    loading,
    renameFile,
    renameMany,
    deleteMany,
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

  const pending = isDeleting || isRenaming;
  const hasRows = rows.length > 0;
  const selectedNames = useMemo(
    () => Object.keys(selectedVideos).filter((key) => selectedVideos[key]),
    [selectedVideos],
  );

  const onRenameDraftChange = (videoName: string, value: string) => {
    setRenameDraft((state) => ({
      ...state,
      [videoName]: value,
    }));
  };
  const toggleSelected = (videoName: string) => {
    setSelectedVideos((state) => ({
      ...state,
      [videoName]: !state[videoName],
    }));
  };

  const onRename = (videoName: string) => {
    void renameFile({
      videoName,
      newName: renameDraft[videoName] || undefined,
    });
  };

  const onBulkDelete = () => {
    if (selectedNames.length === 0) {
      return;
    }
    void deleteMany(selectedNames);
  };

  const onBulkRename = () => {
    if (selectedNames.length === 0 || !bulkPrefix.trim()) {
      return;
    }

    const renamePayload: RenameFilePayload[] = selectedNames.map((name, index) => {
      const suffix = name.includes(".") ? `.${name.split(".").pop()}` : "";
      return {
        videoName: name,
        newName: `${bulkPrefix.trim()}_${index + 1}${suffix}`,
      };
    });

    void renameMany(renamePayload);
  };

  const onDelete = (videoName: string) => {
    void deleteMany([videoName]);
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              value={bulkPrefix}
              onChange={(event) => setBulkPrefix(event.target.value)}
              placeholder="bulk_name"
              className="rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs text-[var(--ink)] outline-none"
            />
            <button
              type="button"
              onClick={onBulkRename}
              disabled={pending || selectedNames.length === 0 || !bulkPrefix.trim()}
              className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-xs text-[var(--ink)] disabled:opacity-50"
            >
              Rename selected
            </button>
            <button
              type="button"
              onClick={onBulkDelete}
              disabled={pending || selectedNames.length === 0}
              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              Delete selected
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <div
                key={row.videoId}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-3"
              >
                <label className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedVideos[row.videoName])}
                    onChange={() => toggleSelected(row.videoName)}
                  />
                  Select
                </label>
                <div className="truncate text-sm font-semibold text-[var(--ink)]">{row.videoName}</div>
                <div className="mt-1 text-[11px] text-[var(--muted)]">status: {row.status}</div>

                <div className="mt-2 flex gap-1">
                  <input
                    value={renameDraft[row.videoName] ?? ""}
                    onChange={(event) => onRenameDraftChange(row.videoName, event.target.value)}
                    placeholder="new_name.mp4"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--card-border)] bg-white px-2 py-1 text-xs text-[var(--ink)] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onRename(row.videoName)}
                    disabled={pending}
                    className="rounded-lg border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--ink)] disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row.videoName)}
                    disabled={pending}
                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    Delete
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
