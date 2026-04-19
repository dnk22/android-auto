import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { FixedSizeList, type ListChildComponentProps } from "react-window";

import { useAutomationSheet } from "../hooks/useAutomationSheet";
import { useAutomationStore } from "../store/automation.store";
import type { SheetConfig, SheetRow, SheetStatus } from "../types/automation.types";
import { canEditRow } from "../utils/validators";
import { useJob } from "../hooks/useJob";
import { useStore } from "../../store/useStore.js";

type GlobalDevice = {
  id: string;
  u2: boolean;
  u2_status: string;
};

const statusClassMap: Record<SheetStatus, string> = {
  idle: "bg-[var(--chip-muted-bg)] text-[var(--chip-muted-fg)]",
  ready: "bg-blue-100 text-blue-700",
  running: "bg-yellow-100 text-yellow-800",
  done: "bg-[var(--chip-success-bg)] text-[var(--chip-success-fg)]",
  error: "bg-[var(--chip-danger-bg)] text-[var(--chip-danger-fg)]",
  missing_file: "bg-[var(--chip-danger-bg)] text-[var(--chip-danger-fg)]",
};

type RowItemProps = {
  row: SheetRow;
  config: SheetConfig;
  devices: GlobalDevice[];
  onCommit: (videoId: string, patch: Partial<SheetRow>) => Promise<void>;
  onReady: (row: SheetRow) => Promise<void>;
  onStop: (row: SheetRow) => Promise<void>;
  pending: boolean;
  style?: CSSProperties;
};

const RowItem = memo(function RowItem({ row, config, devices, onCommit, onReady, onStop, pending, style }: RowItemProps): JSX.Element {
  const [products, setProducts] = useState(row.products);
  const [deviceId, setDeviceId] = useState(row.deviceId);
  const [hashtagInline, setHashtagInline] = useState(row.hashtagInline ?? "");

  useEffect(() => {
    setProducts(row.products);
    setDeviceId(row.deviceId);
    setHashtagInline(row.hashtagInline ?? "");
  }, [row.products, row.deviceId, row.hashtagInline]);

  const editable = canEditRow(row);
  const showReady = !config.autoReady && row.status !== "running";
  const jobId = typeof row.meta?.jobId === "string" ? row.meta.jobId : "";

  const commitPatch = async (patch: Partial<SheetRow>): Promise<void> => {
    if (!editable) {
      return;
    }
    await onCommit(row.videoId, patch);
  };

  return (
    <div style={style} className={`grid grid-cols-[1.6fr_1.8fr_1.2fr_1fr_1.1fr_1.4fr_1fr] items-center border-b border-[var(--card-border)] ${row.status === "missing_file" ? "bg-red-50/50" : ""}`}>
      <div className="px-3 py-2 text-sm text-[var(--ink)]">{row.videoName}</div>
      <div className="px-3 py-2">
        <input
          value={products}
          disabled={!editable || pending}
          onChange={(event) => setProducts(event.target.value)}
          onBlur={() => void commitPatch({ products })}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <div className="px-3 py-2">
        <select
          value={deviceId}
          disabled={!editable || pending}
          onChange={(event) => {
            const next = event.target.value;
            setDeviceId(next);
            void commitPatch({ deviceId: next });
          }}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Select device</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.id}
            </option>
          ))}
        </select>
      </div>
      <div className="px-3 py-2">
        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClassMap[row.status]}`}>
          {row.status === "missing_file" ? "missing_file !" : row.status}
        </span>
      </div>
      <div className="px-3 py-2">
        {row.createdByDuplicate ? (
          <span className="rounded-full bg-[var(--chip-warm-bg)] px-2 py-1 text-xs font-medium text-[var(--ink)]">duplicate</span>
        ) : (
          <span className="text-xs text-[var(--muted)]">-</span>
        )}
      </div>
      <div className="px-3 py-2">
        <input
          value={hashtagInline}
          disabled={!editable || pending}
          onChange={(event) => setHashtagInline(event.target.value)}
          onBlur={() => void commitPatch({ hashtagInline })}
          className="w-full rounded-lg border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>
      <div className="px-3 py-2">
        <div className="flex items-center gap-2">
          {showReady && (
            <button
              type="button"
              disabled={pending || row.status === "done"}
              onClick={() => void onReady(row)}
              className="rounded-lg bg-[var(--accent-2)] px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              READY
            </button>
          )}
          {row.status === "running" && (
            <button
              type="button"
              disabled={!jobId || pending}
              onClick={() => void onStop(row)}
              className="rounded-lg bg-[var(--chip-danger-fg)] px-3 py-1 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              STOP
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

type VirtualRowData = {
  rows: SheetRow[];
  config: SheetConfig;
  devices: GlobalDevice[];
  onCommit: (videoId: string, patch: Partial<SheetRow>) => Promise<void>;
  onReady: (row: SheetRow) => Promise<void>;
  onStop: (row: SheetRow) => Promise<void>;
  pending: boolean;
};

function VirtualRow({ index, style, data }: ListChildComponentProps<VirtualRowData>): JSX.Element {
  const row = data.rows[index];
  if (!row) {
    return <div style={style} />;
  }

  return (
    <RowItem
      row={row}
      config={data.config}
      devices={data.devices}
      onCommit={data.onCommit}
      onReady={data.onReady}
      onStop={data.onStop}
      pending={data.pending}
      style={style}
    />
  );
}

export function AutomationTable(): JSX.Element {
  const sheet = useAutomationStore((state) => state.sheet);
  const config = useAutomationStore((state) => state.config);
  const { updateRow, setReady, isUpdating, isSettingReady } = useAutomationSheet();
  const { stopByRow, isStopping } = useJob();
  const containerRef = useRef<HTMLElement | null>(null);
  const [tableBodyHeight, setTableBodyHeight] = useState(420);

  const devices = useStore((state: { devices: GlobalDevice[] }) => state.devices);
  const availableDevices = useMemo(() => devices.filter((device) => device.u2), [devices]);

  const pending = isUpdating || isSettingReady || isStopping;
  const shouldVirtualize = sheet.length > 30;
  const overscanCount = sheet.length > 500 ? 10 : 6;

  const recalcBodyHeight = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const rect = el.getBoundingClientRect();
    const viewportBottomPadding = 32;
    const available = window.innerHeight - rect.top - viewportBottomPadding;
    const clamped = Math.max(220, Math.min(620, Math.floor(available)));
    setTableBodyHeight(clamped);
  }, []);

  useEffect(() => {
    recalcBodyHeight();
    window.addEventListener("resize", recalcBodyHeight);
    return () => {
      window.removeEventListener("resize", recalcBodyHeight);
    };
  }, [recalcBodyHeight]);

  const rowData = useMemo<VirtualRowData>(
    () => ({
      rows: sheet,
      config,
      devices: availableDevices,
      onCommit: async (videoId, patch) => {
        await updateRow({ videoId, payload: patch });
      },
      onReady: setReady,
      onStop: stopByRow,
      pending,
    }),
    [sheet, config, availableDevices, updateRow, setReady, stopByRow, pending],
  );

  return (
    <section ref={containerRef} className="card fade-in min-h-[320px] rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Automation Sheet</h2>
        <span className="text-xs text-[var(--muted)]">Rows: {sheet.length}{shouldVirtualize ? " (virtualized)" : ""}</span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[980px]">
          <div className="sticky top-0 z-20 grid grid-cols-[1.6fr_1.8fr_1.2fr_1fr_1.1fr_1.4fr_1fr] border-b border-[var(--card-border)] bg-[var(--panel)] text-left text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
            <div className="px-3 py-2">videoName</div>
            <div className="px-3 py-2">products</div>
            <div className="px-3 py-2">deviceId</div>
            <div className="px-3 py-2">status</div>
            <div className="px-3 py-2">createdByDuplicate</div>
            <div className="px-3 py-2">hashtagInline</div>
            <div className="px-3 py-2">action</div>
          </div>

          {shouldVirtualize ? (
            <FixedSizeList
              height={tableBodyHeight}
              width="100%"
              itemCount={sheet.length}
              itemSize={66}
              itemData={rowData}
              overscanCount={overscanCount}
            >
              {VirtualRow}
            </FixedSizeList>
          ) : (
            <div style={{ maxHeight: tableBodyHeight }} className="overflow-y-auto">
              {sheet.map((row) => (
                <RowItem
                  key={row.videoId}
                  row={row}
                  config={config}
                  devices={availableDevices}
                  onCommit={rowData.onCommit}
                  onReady={setReady}
                  onStop={stopByRow}
                  pending={pending}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
