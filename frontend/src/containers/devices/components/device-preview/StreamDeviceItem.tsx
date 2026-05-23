import type { PointerEvent, ReactNode, RefObject } from "react";
import type { IconProps } from "iconsax-reactjs";

import DebouncedButton from "../../../../components/common/DebouncedButton";
import H264Decoder from "../../../../components/H264Decoder";
import { formatDeviceLabel, type LegacyDevice } from "../../../../types/device";
import DeviceAutoLogPanel from "./DeviceAutoLogPanel";

type ToolbarAction = "back" | "home" | "recents" | "screenshot";

type ToolbarButton = {
  label: string;
  icon: (props: IconProps) => ReactNode;
  action: ToolbarAction;
};

type StreamDeviceItemProps = {
  device: LegacyDevice;
  isActive: boolean;
  streamShellRef: RefObject<HTMLDivElement | null>;
  executionOptions: string[];
  defaultExecutionId: string;
  wsUrl?: string;
  onSelectDevice: (deviceId: string) => void;
  toolbarButtons: ToolbarButton[];
  onToolbarAction: (action: Exclude<ToolbarAction, "screenshot">) => void;
  onScreenshot: (shellRef: RefObject<HTMLDivElement | null>) => void;
  onSocketReady: (socket: WebSocket) => void;
  onFrameStateChange: (state: unknown) => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
};

export default function StreamDeviceItem({
  device,
  isActive,
  streamShellRef,
  executionOptions,
  defaultExecutionId,
  wsUrl,
  onSelectDevice,
  toolbarButtons,
  onToolbarAction,
  onScreenshot,
  onSocketReady,
  onFrameStateChange,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerLeave,
}: StreamDeviceItemProps): JSX.Element {
  return (
    <div
      className={`grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--panel)] ${
        isActive ? "ring-2 ring-[var(--accent)]" : ""
      }`}
    >
      <div className="group relative flex min-h-0 flex-col overflow-hidden">
        <button
          type="button"
          onClick={() => onSelectDevice(device.id)}
          className="flex items-center justify-between h-[42px] gap-2 border-b border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-left"
        >
          <span className="truncate text-xs font-semibold text-[var(--ink)]">
            {formatDeviceLabel(device)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
            {isActive ? "Active" : "Tap"}
          </span>
        </button>

        <div
          ref={isActive ? streamShellRef : undefined}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-2"
        >
          <H264Decoder
            serial={device.id}
            interactive={isActive}
            className="h-full w-full"
            onSocketReady={isActive ? onSocketReady : undefined}
            onFrameStateChange={onFrameStateChange}
            onPointerDown={isActive ? onPointerDown : undefined}
            onPointerMove={isActive ? onPointerMove : undefined}
            onPointerUp={isActive ? onPointerUp : undefined}
            onPointerLeave={isActive ? onPointerLeave : undefined}
          />
        </div>

        <div className="pointer-events-none absolute right-2 top-12 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <div className="flex flex-col items-center gap-2 rounded-2xl p-2 backdrop-blur-sm">
            {toolbarButtons.map((button) => (
              <DebouncedButton
                key={button.label}
                type="button"
                onClick={() => {
                  if (button.action === "screenshot") {
                    onScreenshot(streamShellRef);
                    return;
                  }
                  onToolbarAction(button.action);
                }}
                className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
                title={button.label}
                aria-label={button.label}
                disabled={!isActive}
              >
                <button.icon size="18" color="currentColor" variant="Linear" />
              </DebouncedButton>
            ))}
          </div>
        </div>
      </div>

      <DeviceAutoLogPanel
        deviceId={device.id}
        wsUrl={wsUrl}
        executionOptions={executionOptions}
        defaultExecutionId={defaultExecutionId}
      />
    </div>
  );
}
