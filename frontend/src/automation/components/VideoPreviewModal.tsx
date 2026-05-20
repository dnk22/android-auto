import { useEffect, useRef, useState } from "react";
import { Next, Pause, Play, Previous } from "iconsax-reactjs";

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

          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 pb-4 pt-10">
            <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col gap-3">
              <div className="rounded-full border border-white/10 bg-white/10 px-3 py-2">
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

              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 shadow-lg backdrop-blur-md">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
