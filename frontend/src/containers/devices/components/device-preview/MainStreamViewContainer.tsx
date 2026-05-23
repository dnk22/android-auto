import { useMemo, useRef } from "react";

import { Back, Camera, Home, HamburgerMenu } from "iconsax-reactjs";

import { useStorage } from "../../../../automation/hooks/useStorage";
import { formatDeviceLabel, type LegacyDevice } from "../../../../types/device";
import StreamDeviceItem from "./StreamDeviceItem";
import { useMainStreamController } from "../../hooks/useMainStreamController";

function parseExecutionId(meta: string | null | undefined): string | null {
  if (!meta || !meta.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(meta) as Record<string, unknown>;
    const value = parsed.executionId;
    return typeof value === "string" && value.trim() ? value : null;
  } catch {
    return null;
  }
}

type MainStreamViewContainerProps = {
  streamDevices: LegacyDevice[];
  selectedDevice: string;
  onSelectDevice: (deviceId: string) => void;
};

export default function MainStreamViewContainer({
  streamDevices,
  selectedDevice,
  onSelectDevice,
}: MainStreamViewContainerProps): JSX.Element {
  const streamShellRef = useRef<HTMLDivElement | null>(null);
  const { rows, wsUrl } = useStorage();
  const {
    activeStreamDevice,
    setStreamState,
    onSocketReady,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onToolbarAction,
    onScreenshot,
  } = useMainStreamController();

  const activeDeviceId = activeStreamDevice || selectedDevice;
  const activeDeviceInfo = useMemo(
    () => streamDevices.find((device) => device.id === activeDeviceId),
    [activeDeviceId, streamDevices],
  );
  const executionOptions = useMemo(() => {
    const ids = new Set<string>();
    rows.forEach((row) => {
      const id = parseExecutionId(row.meta);
      if (id) {
        ids.add(id);
      }
    });
    return Array.from(ids);
  }, [rows]);
  const defaultExecutionId = executionOptions[0] ?? "";

  const toolbarButtons = [
    {
      label: "Back",
      icon: Back,
      action: "back" as const,
    },
    {
      label: "Home",
      icon: Home,
      action: "home" as const,
    },
    {
      label: "Recent",
      icon: HamburgerMenu,
      action: "recents" as const,
    },
    {
      label: "Screenshot",
      icon: Camera,
      action: "screenshot" as const,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--muted)]">
          {activeDeviceId
            ? `Dang dieu khien: ${activeDeviceInfo ? formatDeviceLabel(activeDeviceInfo) : activeDeviceId}`
            : "Chua co stream nao duoc chon"}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 overflow-y-auto">
        {streamDevices.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--panel-soft)] text-sm text-[var(--muted)]">
            Chưa có thiết bị nào được kết nối để stream
          </div>
        ) : (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 auto-rows-[minmax(0,1fr)] gap-3 p-2">
            {streamDevices.map((device) => {
              const isActive = device.id === activeDeviceId;

              return (
                <StreamDeviceItem
                  key={device.id}
                  device={device}
                  isActive={isActive}
                  streamShellRef={streamShellRef}
                  executionOptions={executionOptions}
                  defaultExecutionId={defaultExecutionId}
                  wsUrl={wsUrl}
                  onSelectDevice={onSelectDevice}
                  toolbarButtons={toolbarButtons}
                  onToolbarAction={onToolbarAction}
                  onScreenshot={onScreenshot}
                  onSocketReady={onSocketReady}
                  onFrameStateChange={setStreamState}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerLeave}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
