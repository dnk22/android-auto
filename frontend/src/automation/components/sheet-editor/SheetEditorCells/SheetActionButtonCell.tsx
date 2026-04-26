import type { JSX } from "react";

import DebouncedButton from "../../../../components/common/DebouncedButton";
import type { SheetStatus } from "../../../types/sheetStatus.types";

interface SheetActionButtonCellProps {
  rowIndex: number;
  videoId: string;
  status: SheetStatus;
  videoName: string;
  products: string[];
  hashtagInline?: string | null;
  hashtagCommon?: string | null;
  isSessionAutoReady: boolean;
  onSaveRow: (index: number) => void;
  onSetStatusByVideoId: (videoId: string, status: SheetStatus) => void;
  onDeleteRowByVideoName: (videoName: string) => void;
}

export function SheetActionButtonCell({
  rowIndex,
  videoId,
  status,
  videoName,
  products,
  hashtagInline,
  hashtagCommon,
  isSessionAutoReady,
  onSaveRow,
  onSetStatusByVideoId,
  onDeleteRowByVideoName,
}: SheetActionButtonCellProps): JSX.Element {
  const hasProducts =
    Array.isArray(products) && products.some((item) => item.trim().length > 0);
  const hasHashtagCommon = (hashtagCommon ?? "").trim().length > 0;
  const hasHashtagInline = (hashtagInline ?? "").trim().length > 0;
  const canReady =
    status === "idle" && hasProducts && (hasHashtagCommon || hasHashtagInline);
  const showReady = !isSessionAutoReady && status !== "missing_file";
  const showCancel = showReady && status === "ready";
  const showSave = status === "idle";
  const showDelete = status === "missing_file";
  const showReadyButton = showReady && status === "idle";
  const showAnyButton = showSave || showDelete || showReadyButton || showCancel;

  return (
    <>
      {showAnyButton ? (
        <div className="flex w-full gap-2">
          {showSave ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-[var(--accent-2)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSaveRow(rowIndex)}
            >
              Save
            </DebouncedButton>
          ) : null}

          {showReadyButton ? (
            <DebouncedButton
              type="button"
              disabled={!canReady}
              className="h-10 flex-1 rounded-md bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (!canReady) {
                  return;
                }
                onSetStatusByVideoId(videoId, "ready");
              }}
            >
              Ready
            </DebouncedButton>
          ) : null}

          {showCancel ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md border border-[var(--card-border)] px-4 py-2 text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSetStatusByVideoId(videoId, "idle")}
            >
              Cancel
            </DebouncedButton>
          ) : null}

          {showDelete ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-red-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => {
                const confirmed = window.confirm(
                  `Xóa record cho video "${videoName}"? Hành động này không thể hoàn tác.`,
                );
                if (!confirmed) {
                  return;
                }
                onDeleteRowByVideoName(videoName);
              }}
            >
              Xóa
            </DebouncedButton>
          ) : null}
        </div>
      ) : (
        <div className="h-10 w-full" />
      )}
    </>
  );
}
