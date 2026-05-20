import DebouncedButton from "../../components/common/DebouncedButton";

type ConfirmDeleteModalProps = {
  isOpen: boolean;
  videoName: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  isOpen,
  videoName,
  pending = false,
  onCancel,
  onConfirm,
}: ConfirmDeleteModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="card w-full max-w-md rounded-2xl p-4">
        <h3 className="text-lg font-semibold text-[var(--ink)]">Xác nhận xóa video</h3>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Bạn chắc chắn muốn xóa <strong>{videoName}</strong>?
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <DebouncedButton
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--card-border)] px-8 py-4 text-sm text-[var(--ink)]"
          >
            Hủy
          </DebouncedButton>
          <DebouncedButton
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-[var(--chip-danger-bg)] px-8 py-4 text-sm font-semibold text-[var(--chip-danger-fg)] disabled:opacity-60"
          >
            Ok
          </DebouncedButton>
        </div>
      </div>
    </div>
  );
}
