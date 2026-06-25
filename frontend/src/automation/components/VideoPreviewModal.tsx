import { useEffect, useRef, useState } from "react";
import { Next, Pause, Play, Previous, TickCircle } from "iconsax-reactjs";

import { analyzeStorageVideoCaption } from "../api/automation.api";
import type { CaptionAnalyzeResult } from "../types/automation.types";
import DebouncedButton from "../../components/common/DebouncedButton";

type VideoPreviewModalProps = {
  isOpen: boolean;
  videoName: string;
  videoUrl: string;
  onClose: () => void;
};

export function VideoPreviewModal({
  isOpen,
  videoName,
  videoUrl,
  onClose,
}: VideoPreviewModalProps): JSX.Element | null {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isCheckingCaption, setIsCheckingCaption] = useState(false);
  const [captionResult, setCaptionResult] = useState<CaptionAnalyzeResult | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const video = videoRef.current;
    if (!video) {
      return undefined;
    }

    video.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setIsCheckingCaption(false);
    setCaptionResult(null);
    setCaptionError(null);

    return undefined;
  }, [isOpen, videoUrl]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const safeDuration = Number.isFinite(video.duration)
      ? video.duration
      : video.currentTime + Math.abs(seconds);
    const nextTime = Math.min(
      Math.max(video.currentTime + seconds, 0),
      safeDuration,
    );
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      const playPromise = video.play();
      if (playPromise) {
        playPromise.catch(() => undefined);
      }
      return;
    }

    video.pause();
  };

  const handleTimeUpdate = () => {
    if (isSeeking) {
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setCurrentTime(video.currentTime || 0);
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    setDuration(Number.isFinite(video.duration) ? video.duration : 0);
  };

  const handleSeekChange = (value: number) => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const nextTime = Math.min(Math.max(value, 0), duration || value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleCheckCaption = async () => {
    if (!videoName || isCheckingCaption) {
      return;
    }
    setIsCheckingCaption(true);
    setCaptionResult(null);
    setCaptionError(null);
    try {
      const result = await analyzeStorageVideoCaption(videoName);
      setCaptionResult(result);
    } catch (error) {
      setCaptionError(error instanceof Error ? error.message : "Check caption thất bại");
    } finally {
      setIsCheckingCaption(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#050816] shadow-[0_30px_90px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {videoName}
            </h3>
          </div>

          <DebouncedButton
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            Đóng
          </DebouncedButton>
        </div>

        <div className="relative flex items-center justify-center bg-black">
          <video
            ref={videoRef}
            key={videoUrl}
            src={videoUrl}
            className="aspect-video h-full w-full max-h-[72vh] object-contain"
            controls={false}
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
          />
        </div>

        <div className="border-t border-white/10 bg-[#080c1d] px-4 py-4">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
            <div className="rounded-full border border-white/10 bg-black/30 px-3 py-2">
              <input
                type="range"
                min={0}
                max={Math.max(duration, 0)}
                step={0.05}
                value={Math.min(currentTime, duration || currentTime)}
                onChange={(event) =>
                  handleSeekChange(Number(event.target.value))
                }
                onMouseDown={() => setIsSeeking(true)}
                onMouseUp={(event) => {
                  setIsSeeking(false);
                  handleSeekChange(
                    Number((event.target as HTMLInputElement).value),
                  );
                }}
                onTouchStart={() => setIsSeeking(true)}
                onTouchEnd={(event) => {
                  setIsSeeking(false);
                  handleSeekChange(
                    Number((event.target as HTMLInputElement).value),
                  );
                }}
                className="h-1.5 w-full cursor-pointer accent-[var(--accent)]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <DebouncedButton
                type="button"
                onClick={() => seek(-10)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                <Previous size="18" color="currentColor" />
              </DebouncedButton>

              <DebouncedButton
                type="button"
                onClick={togglePlay}
                className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-semibold text-white transition hover:opacity-90"
              >
                {isPlaying ? (
                  <Pause size="18" color="currentColor" variant="Bold" />
                ) : (
                  <Play size="18" color="currentColor" variant="Bold" />
                )}
              </DebouncedButton>

              <DebouncedButton
                type="button"
                onClick={() => seek(10)}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
              >
                <Next size="18" color="currentColor" />
              </DebouncedButton>
            </div>

            <div className="flex flex-col items-center gap-2 border-t border-white/10 pt-3">
              <DebouncedButton
                type="button"
                onClick={handleCheckCaption}
                disabled={isCheckingCaption}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  captionResult
                    ? "border-emerald-300/50 bg-emerald-400/25 text-emerald-50"
                    : "border-emerald-300/30 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25 disabled:cursor-wait disabled:opacity-70"
                }`}
              >
                <TickCircle size="18" color="currentColor" variant="Bold" />
                {isCheckingCaption ? "Đang check..." : captionResult ? "Check lại" : "Check"}
              </DebouncedButton>

              {captionResult ? (
                <div className="w-full rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-center text-xs text-emerald-50">
                  <span className="font-semibold">{captionResult.caption_type}</span>
                  <span className="text-emerald-100/80">
                    {" "}
                    · {Math.round(captionResult.confidence * 100)}% · {captionResult.summary}
                  </span>
                </div>
              ) : null}

              {captionError ? (
                <div className="w-full rounded-xl border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-center text-xs text-rose-100">
                  {captionError}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
