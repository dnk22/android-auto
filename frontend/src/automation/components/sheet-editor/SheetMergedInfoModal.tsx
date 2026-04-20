import type { JSX } from "react";

import DebouncedButton from "../../../components/common/DebouncedButton";
import type { SheetMergedInfoPayload } from "../../hooks/useSheetMergedInfoModal";

interface SheetMergedInfoModalProps {
  info: SheetMergedInfoPayload | null;
  onClose: () => void;
}

export function SheetMergedInfoModal({
  info,
  onClose,
}: SheetMergedInfoModalProps): JSX.Element | null {
  if (!info) {
    return null;
  }

  const metaText = info.meta.trim() || "(empty)";
  const startedAtText = info.startedAt.trim() || "-";
  const finishedAtText = info.finishedAt.trim() || "-";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-[var(--ink)]">
            Thông tin chi tiết
          </h3>
          <DebouncedButton
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--card-border)] px-2 py-1 text-xs text-[var(--muted)]"
          >
            Đóng
          </DebouncedButton>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Tên video
            </p>
            <p className="text-[var(--ink)]">{info.videoName}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Meta
            </p>
            <p className="whitespace-pre-wrap break-words text-[var(--ink)]">
              {metaText}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
              Thời gian bắt đầu - kết thúc
            </p>
            <p className="text-[var(--ink)]">
              {startedAtText || "-"} {"->"} {finishedAtText || "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
