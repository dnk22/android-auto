import { useRef } from "react";

import { Back, Camera, Home, HamburgerMenu } from "iconsax-reactjs";

import DebouncedButton from "../../../components/common/DebouncedButton";
import H264Decoder from "../../../components/H264Decoder";
import { useMainStreamController } from "./hooks/useMainStreamController";

export default function MainStreamViewContainer(): JSX.Element {
  const streamShellRef = useRef<HTMLDivElement | null>(null);
  const {
    activeStreamDevice,
    selectedDeviceInfo,
    streamState,
    setStreamState,
    onSocketReady,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onToolbarAction,
    onScreenshot,
  } = useMainStreamController();

  const toolbarButtons = [
    {
      label: "Back",
      onClick: () => onToolbarAction("back"),
      icon: Back,
    },
    {
      label: "Home",
      onClick: () => onToolbarAction("home"),
      icon: Home,
    },
    {
      label: "Recent",
      onClick: () => onToolbarAction("recents"),
      icon: HamburgerMenu,
    },
    {
      label: "Screenshot",
      onClick: () => onScreenshot(streamShellRef),
      icon: Camera,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-2xl text-[var(--ink)]">
          Main Preview
        </h4>
        <p className="text-sm text-[var(--muted)]">
          {activeStreamDevice
            ? `Streaming : ${activeStreamDevice}`
            : "Không có stream nào được chọn"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="group flex h-full max-h-full w-full items-start justify-center overflow-hidden">
          <div className="h-[164px] w-[52px] shrink-0 opacity-0" aria-hidden="true" />
          <div
            ref={streamShellRef}
            className="relative h-full max-h-full w-auto max-w-[calc(100%-64px)] overflow-hidden rounded-[2rem] aspect-[10/19]"
          >
            {activeStreamDevice ? (
              <H264Decoder
                serial={activeStreamDevice}
                interactive
                className="h-full w-full"
                onSocketReady={onSocketReady}
                onFrameStateChange={setStreamState}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerLeave}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-4 text-center text-sm text-slate-300">
                Chưa có thiết bị nào được chọn để xem trước.
              </div>
            )}
          </div>

          <div className="opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <div className="flex h-[164px] w-[52px] flex-col items-center justify-center gap-2 rounded-2xl bg-black/60 p-2 backdrop-blur-sm">
              {toolbarButtons.map((button) => (
                <DebouncedButton
                  key={button.label}
                  type="button"
                  onClick={button.onClick}
                  className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
                  title={button.label}
                  aria-label={button.label}
                  disabled={!activeStreamDevice}
                >
                  <button.icon size="18" color="currentColor" variant="Linear" />
                </DebouncedButton>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
