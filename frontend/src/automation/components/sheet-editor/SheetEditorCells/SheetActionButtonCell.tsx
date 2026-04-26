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
  isDirty: boolean;
  isWatching: boolean;
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
  isDirty,
  isWatching,
  isSessionAutoReady,
  onSaveRow,
  onSetStatusByVideoId,
  onDeleteRowByVideoName,
}: SheetActionButtonCellProps): JSX.Element {
  const hasProducts =
    Array.isArray(products) && products.some((item) => item.trim().length > 0);
  const hasHashtagCommon = (hashtagCommon ?? "").trim().length > 0;
  const hasHashtagInline = (hashtagInline ?? "").trim().length > 0;
  const hasValidVideo = videoName.trim().length > 0;
  const canRun =
    hasProducts && (hasHashtagCommon || hasHashtagInline) && hasValidVideo;

  const showSave = status === "idle";
  const showReady = status === "idle" && !isWatching && !isSessionAutoReady;
  const showDelete =
    status === "missing_file" || status === "done" || status === "stopped";
  const showCancel = status === "queued" || status === "ready";
  const showPause = status === "running";
  const showStop = status === "running" || status === "paused";
  const showResume = status === "paused";
  const showRetry =
    status === "done" || status === "stopped" || status === "error";
  const showAnyButton =
    showSave ||
    showReady ||
    showDelete ||
    showCancel ||
    showPause ||
    showStop ||
    showResume ||
    showRetry;

  return (
    <>
      {showAnyButton ? (
        <div className="flex w-full gap-2">
          {showSave ? (
            <DebouncedButton
              type="button"
              disabled={!isDirty}
              className="h-10 flex-1 rounded-md bg-[var(--accent-2)] px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => onSaveRow(rowIndex)}
            >
              Save
            </DebouncedButton>
          ) : null}

          {showReady ? (
            <DebouncedButton
              type="button"
              disabled={!canRun}
              className="h-10 flex-1 rounded-md bg-emerald-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (!canRun) {
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
              className="h-10 flex-1 rounded-md border border-[var(--card-border)] px-4 py-2 text-[var(--ink)]"
              onClick={() => onSetStatusByVideoId(videoId, "idle")}
            >
              Cancel
            </DebouncedButton>
          ) : null}

          {showPause ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-amber-600 px-4 py-2 text-white"
              onClick={() => onSetStatusByVideoId(videoId, "paused")}
            >
              Pause
            </DebouncedButton>
          ) : null}

          {showStop ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-rose-600 px-4 py-2 text-white"
              onClick={() => onSetStatusByVideoId(videoId, "stopped")}
            >
              Stop
            </DebouncedButton>
          ) : null}

          {showResume ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-cyan-600 px-4 py-2 text-white"
              onClick={() => onSetStatusByVideoId(videoId, "running")}
            >
              Resume
            </DebouncedButton>
          ) : null}

          {showRetry ? (
            <DebouncedButton
              type="button"
              disabled={!canRun}
              className="h-10 flex-1 rounded-md bg-indigo-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => {
                if (!canRun) {
                  return;
                }
                onSetStatusByVideoId(videoId, "ready");
              }}
            >
              Retry
            </DebouncedButton>
          ) : null}

          {showDelete ? (
            <DebouncedButton
              type="button"
              className="h-10 flex-1 rounded-md bg-red-600 px-4 py-2 text-white"
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
