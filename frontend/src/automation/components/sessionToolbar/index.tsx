import { useCallback } from "react";
import { ArrowCircleRight, Autobrightness, Pause } from "iconsax-reactjs";
import { useSessionToolbar } from "../../hooks/useSessionToolbar";
import { selectHasU2Device, useStore } from "../../../store/useStore";

export function SessionToolbar(): JSX.Element {
  const hasU2Device = useStore(selectHasU2Device);

  const {
    sessionStatusText,
    autoReadyText,
    isWatching,
    isAutoReady,
    isVideoFolderCreated,
    handleWatching,
    handleIdle,
    handleAutoReady,
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

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="mt-2 font-display text-2xl text-[var(--ink)]">
            Session + Job Editor
          </h1>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Trạng thái: {sessionStatusText} | auto-ready: {autoReadyText}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
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
            title={hasU2Device ? undefined : "Cần ít nhất 1 device có u2 = true"}
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
          </button>
          <div className="mx-1 h-6 w-px bg-[var(--card-border)]" />
          <button
            type="button"
            onClick={handleAutoReady}
            disabled={!hasU2Device}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white flex items-center gap-1 transition-colors ${
              !hasU2Device
                ? "cursor-not-allowed bg-gray-400"
                : isAutoReady
                  ? "bg-emerald-600"
                  : "bg-gray-500"
            }`}
          >
            <Autobrightness size="20" color="white" />
            Auto ready
          </button>
        </div>
      </div>

      {isVideoFolderModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="card w-full max-w-md rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-[var(--ink)]">Video folder chưa tồn tại</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Bạn muốn tạo folder video ở đâu?
            </p>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  void handleCreateVideoFolder(false);
                }}
                disabled={isCreatingVideoFolder}
                className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--panel-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Hiện tại
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleCreateVideoFolder(true);
                }}
                disabled={isCreatingVideoFolder}
                className="rounded-lg bg-[var(--accent-2)] px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Desktop
              </button>
            </div>

          </div>
        </div>
      ) : null}
    </>
  );
}
