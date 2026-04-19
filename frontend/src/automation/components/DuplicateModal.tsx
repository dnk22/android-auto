import { useState } from "react";

import { toast } from "react-toastify";

import { useStorage } from "../hooks/useStorage";
import { useAutomationStore } from "../store/automation.store";

export function DuplicateModal(): JSX.Element | null {
  const duplicateModal = useAutomationStore((state) => state.duplicateModal);
  const closeDuplicateModal = useAutomationStore((state) => state.closeDuplicateModal);
  const { renameFile } = useStorage();
  const [draftName, setDraftName] = useState("");

  if (!duplicateModal.isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md rounded-2xl p-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Duplicate file detected</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          File <strong>{duplicateModal.originalName}</strong> was auto-renamed to <strong>{duplicateModal.currentName}</strong>.
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Rename now (optional)</span>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="my_video_name.mp4"
            className="rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)]"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              closeDuplicateModal();
              setDraftName("");
            }}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-sm text-[var(--ink)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              try {
                await renameFile({
                  videoName: duplicateModal.currentName,
                  newName: draftName || undefined,
                });
                closeDuplicateModal();
                setDraftName("");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Rename failed");
              }
            }}
            className="rounded-lg bg-[var(--accent-2)] px-3 py-1 text-sm font-semibold text-white"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
