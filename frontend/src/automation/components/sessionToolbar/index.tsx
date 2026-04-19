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
    handleWatching,
    handleIdle,
    handleAutoReady,
  } = useSessionToolbar();

  return (
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
          onClick={isWatching ? handleIdle : handleWatching}
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
  );
}
