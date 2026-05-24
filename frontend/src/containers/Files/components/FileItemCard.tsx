import { useEffect, useState } from "react";

import DebouncedButton from "../../../components/common/DebouncedButton";
import { buildStorageThumbUrl } from "../../../automation/api/automation.api";
import type { SheetRow } from "../../../automation/types/automation.types";
import { Trash } from "iconsax-reactjs";

type FileItemCardProps = {
  row: SheetRow;
  isEditing: boolean;
  editingValue: string;
  pending: boolean;
  onStartEdit: (videoId: string, videoName: string) => void;
  onCancelEdit: () => void;
  onEditValueChange: (value: string) => void;
  onRenameAction: (videoId: string, videoName: string) => void;
  onDelete: (videoName: string) => void;
  onOpenPreview: (videoName: string) => void;
};

export default function FileItemCard({
  row,
  isEditing,
  editingValue,
  pending,
  onStartEdit,
  onCancelEdit,
  onEditValueChange,
  onRenameAction,
  onDelete,
  onOpenPreview,
}: FileItemCardProps): JSX.Element {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);

  useEffect(() => {
    setThumbnailFailed(false);
  }, [row.videoName]);

  const thumbnailUrl = row.videoName ? buildStorageThumbUrl(row.videoName) : "";

  return (
    <article className="rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] p-4 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)]">
          {thumbnailUrl && !thumbnailFailed ? (
            <img
              src={thumbnailUrl}
              alt={`Thumbnail ${row.videoName}`}
              className="h-full w-full object-cover"
              draggable={false}
              onError={() => setThumbnailFailed(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Video
            </div>
          )}
        </div>

        <div className="flex items-center w-full gap-2">
          {isEditing ? (
            <input
              value={editingValue}
              onChange={(event) => onEditValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelEdit();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  onRenameAction(row.videoId, row.videoName);
                }
              }}
              placeholder="video_name.mp4"
              autoFocus
              className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-sm font-semibold text-[var(--ink)] outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
            />
          ) : (
            <DebouncedButton
              type="button"
              onDoubleClick={() => onStartEdit(row.videoId, row.videoName)}
              className="block w-full truncate text-left text-sm font-semibold text-[var(--ink)] eclipsed max-w-[70%]"
              title="Double click để đổi tên"
            >
              {row.videoName}
            </DebouncedButton>
          )}
          <DebouncedButton
            type="button"
            onClick={() =>
              isEditing ? onCancelEdit() : onDelete(row.videoName)
            }
            disabled={pending}
            className={`rounded-lg p-3 text-xs font-semibold disabled:opacity-50 ${"bg-[var(--chip-danger-bg)] text-[var(--chip-danger-fg)]"}`}
          >
            {isEditing ? (
              "Hủy"
            ) : (
              <Trash size="16" color="currentColor" variant="Linear" />
            )}
          </DebouncedButton>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <DebouncedButton
          type="button"
          onClick={() => onOpenPreview(row.videoName)}
          disabled={pending}
          className="flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-xs font-semibold text-[var(--ink)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Chỉnh sửa
        </DebouncedButton>

        <DebouncedButton
          type="button"
          onClick={() => onRenameAction(row.videoId, row.videoName)}
          disabled={pending}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
            isEditing
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--card-border)] bg-[var(--panel-soft)] text-[var(--ink)]"
          }`}
        >
          {isEditing ? "Lưu" : "Đổi tên"}
        </DebouncedButton>
      </div>
    </article>
  );
}
