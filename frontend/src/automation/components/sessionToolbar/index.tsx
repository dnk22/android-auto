import { useCallback } from "react";
import { ArrowCircleRight, Autobrightness, Pause } from "iconsax-reactjs";
import { useSessionToolbar } from "../../hooks/useSessionToolbar";
import DebouncedButton from "../../../components/common/DebouncedButton";
import { selectHasU2Device, useStore } from "../../../store/useStore";

export function SessionToolbar(): JSX.Element {
  const hasU2Device = useStore(selectHasU2Device);

  const {
    sessionStatusText,
    autoReadyText,
    isWatching,
    isAutoReady,
    hashtagCommonValue,
    isHashtagCommonDisabled,
    isVideoFolderCreated,
    handleWatching,
    handleIdle,
    handleAutoReady,
    handleHashtagCommonChange,
    submitHashtagCommon,
    clearHashtagCommon,
    createVideoFolderAt,
    isCreatingVideoFolder,
  } = useSessionToolbar();

  const isVideoFolderModalOpen = isWatching && !isVideoFolderCreated;

  const handleStart = useCallback(() => {
    handleWatching();
  }, [handleWatching]);

  const handleCreateVideoFolder = useCallback(
    async (isDesktop: boolean) => {
      await createVideoFolderAt(isDesktop);
    },
    [createVideoFolderAt],
  );

  const isDisableAutoReady = !hasU2Device || !isWatching;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <textarea
              rows={3}
              value={hashtagCommonValue}
              disabled={isHashtagCommonDisabled}
              onChange={(event) => {
                handleHashtagCommonChange(event.target.value);
              }}
              onBlur={submitHashtagCommon}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submitHashtagCommon();
                }
              }}
              placeholder="Hashtag chung"
              className="w-[260px] resize-none rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <DebouncedButton
            type="button"
            onClick={clearHashtagCommon}
            disabled={isHashtagCommonDisabled}
            className="h-14 rounded-md border border-[var(--card-border)] px-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--card-border)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Xóa
          </DebouncedButton>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DebouncedButton
              type="button"
              onClick={isWatching ? handleIdle : handleStart}
              disabled={!hasU2Device}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1 transition-colors ${
                !hasU2Device
                  ? "cursor-not-allowed bg-gray-400"
                  : isWatching
                    ? "bg-yellow-600"
                    : "bg-emerald-600"
              }`}
              title={
                hasU2Device
                  ? undefined
                  : "Cần ít nhất 1 device để bắt đầu session"
              }
            >
              {isWatching ? (
                <>
                  <Pause size="20" color="white" />
                  Tạm dừng
                </>
              ) : (
                <>
                  <ArrowCircleRight size="20" color="white" />
                  Bắt đầu
                </>
              )}
            </DebouncedButton>
            <div className="mx-1 h-6 w-px bg-[var(--card-border)]" />
            <DebouncedButton
              type="button"
              onClick={handleAutoReady}
              disabled={isDisableAutoReady}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1 transition-colors ${
                isDisableAutoReady
                  ? "cursor-not-allowed bg-gray-400"
                  : isAutoReady
                    ? "bg-emerald-600"
                    : "bg-gray-500"
              }`}
            >
              <Autobrightness size="20" color="white" />
              Auto ready
            </DebouncedButton>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Trạng thái:{" "}
            <span className="font-semibold text-[var(--accent-1)]">
              {sessionStatusText}
            </span>{" "}
            | auto-ready: {autoReadyText}
          </p>
        </div>
      </div>

      {isVideoFolderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-md rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">
              Video folder chưa tồn tại
            </h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Bạn muốn tạo folder video ở đâu?
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <DebouncedButton
                type="button"
                onClick={() => {
                  void handleCreateVideoFolder(false);
                }}
                disabled={isCreatingVideoFolder}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hiện tại
              </DebouncedButton>
              <DebouncedButton
                type="button"
                onClick={() => {
                  void handleCreateVideoFolder(true);
                }}
                disabled={isCreatingVideoFolder}
                className="rounded-lg bg-[var(--accent-2)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Desktop
              </DebouncedButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
