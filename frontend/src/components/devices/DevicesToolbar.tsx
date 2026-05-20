import { Refresh } from "iconsax-reactjs";
import DebouncedButton from "../common/DebouncedButton";

type DevicesToolbarProps = {
  canConnectAll: boolean;
  canDisconnectAll: boolean;
  isConnectingAll: boolean;
  isDisconnectingAll: boolean;
  onConnectAll: () => Promise<void>;
  onDisconnectAll: () => Promise<void>;
  onRefresh: () => Promise<void>;
};

export default function DevicesToolbar({
  canConnectAll,
  canDisconnectAll,
  isConnectingAll,
  isDisconnectingAll,
  onConnectAll,
  onDisconnectAll,
  onRefresh,
}: DevicesToolbarProps): JSX.Element {
  return (
    <div className="card fade-in flex items-center justify-between p-4">
      <div className="flex gap-2">
        <DebouncedButton
          type="button"
          onClick={() => {
            void onConnectAll();
          }}
          className="rounded-lg bg-[var(--chip-success-bg)] px-4 py-2 text-sm font-semibold text-[var(--chip-success-fg)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canConnectAll || isConnectingAll || isDisconnectingAll}
        >
          {isConnectingAll ? "Đang kết nối..." : "Kết nối tất cả"}
        </DebouncedButton>
        <DebouncedButton
          type="button"
          onClick={() => {
            void onDisconnectAll();
          }}
          className="rounded-lg bg-[var(--chip-danger-bg)] px-4 py-2 text-sm font-semibold text-[var(--chip-danger-fg)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canDisconnectAll || isConnectingAll || isDisconnectingAll}
        >
          {isDisconnectingAll ? "Đang ngắt kết nối..." : "Ngắt kết nối tất cả"}
        </DebouncedButton>
      </div>
      <DebouncedButton
        type="button"
        onClick={() => {
          void onRefresh();
        }}
        className="rounded-lg bg-[var(--chip-info-bg)] px-4 py-2 text-sm font-semibold text-[var(--chip-info-fg)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Refresh size="32" color="currentColor" />
      </DebouncedButton>
    </div>
  );
}
