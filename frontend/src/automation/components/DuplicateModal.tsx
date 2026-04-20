import DebouncedButton from "../../components/common/DebouncedButton";

type DuplicateModalProps = {
  isOpen: boolean;
  originalName: string;
  currentName: string;
  draftName: string;
  onDraftNameChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DuplicateModal({
  isOpen,
  originalName,
  currentName,
  draftName,
  onDraftNameChange,
  onCancel,
  onConfirm,
}: DuplicateModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md rounded-2xl p-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Duplicate file detected</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          File <strong>{originalName}</strong> was auto-renamed to <strong>{currentName}</strong>.
        </p>

        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">Rename now (optional)</span>
          <input
            value={draftName}
            onChange={(event) => onDraftNameChange(event.target.value)}
            placeholder="my_video_name.mp4"
            className="rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)]"
          />
        </label>

        <div className="mt-4 flex items-center justify-end gap-2">
          <DebouncedButton
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--card-border)] px-3 py-1 text-sm text-[var(--ink)]"
          >
            Cancel
          </DebouncedButton>
          <DebouncedButton
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-[var(--accent-2)] px-3 py-1 text-sm font-semibold text-white"
          >
            OK
          </DebouncedButton>
        </div>
      </div>
    </div>
  );
}
