import { FixedSizeList as List } from "react-window";
import type { ListChildComponentProps } from "react-window";
import type {
  SheetEditorFieldRow,
  SheetEditorTableProps,
} from "../../../types/automation/editor.types";
import type { SheetStatus } from "../../types/automation.types";

const STATUS_OPTIONS: SheetStatus[] = [
  "idle",
  "queued",
  "ready",
  "running",
  "paused",
  "stopped",
  "done",
  "error",
  "missing_file",
];

function SheetEditorHeader(): JSX.Element {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_1fr_0.5fr_0.8fr_0.8fr_auto] gap-2 border-b border-[var(--card-border)] px-2 py-2 text-[11px] uppercase tracking-[0.08em] text-[var(--muted)]">
      <span>video_name</span>
      <span>device_id</span>
      <span>products</span>
      <span>hashtag_inline</span>
      <span>status</span>
      <span>meta</span>
      <span>version</span>
      <span>started_at</span>
      <span>finished_at</span>
      <span>action</span>
    </div>
  );
}

interface SheetEditorRowData {
  fields: SheetEditorFieldRow[];
  register: SheetEditorTableProps["register"];
  deviceOptions: string[];
  onSaveRow: (index: number) => void;
}

function SheetEditorRow({
  index,
  style,
  data,
}: ListChildComponentProps<SheetEditorRowData>): JSX.Element | null {
  const { fields, register, deviceOptions, onSaveRow } = data;
  const row = fields[index];

  if (!row) {
    return null;
  }

  const rowPrefix = `rows.${index}` as const;

  return (
    <div style={style} className="border-b border-[var(--card-border)] px-2 py-2">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_1fr_0.5fr_0.8fr_0.8fr_auto] items-center gap-2 text-xs">
        <div className="truncate text-[var(--ink)]">{row.videoName}</div>

        <select
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.deviceId` as const)}
        >
          <option value="">-</option>
          {deviceOptions.map((deviceId) => (
            <option key={`${row.id}-${deviceId}`} value={deviceId}>
              {deviceId}
            </option>
          ))}
        </select>

        <input
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.products` as const)}
        />

        <input
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.hashtagInline` as const)}
        />

        <select
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.status` as const)}
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={`${row.id}-${status}`} value={status}>
              {status}
            </option>
          ))}
        </select>

        <input
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.meta` as const)}
        />

        <div className="text-center text-[var(--muted)]">{row.version}</div>

        <input
          type="number"
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.startedAt` as const)}
        />

        <input
          type="number"
          className="rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-1"
          {...register(`${rowPrefix}.finishedAt` as const)}
        />

        <button
          type="button"
          className="rounded-md bg-[var(--accent-2)] px-2 py-1 text-white"
          onClick={() => onSaveRow(index)}
        >
          Save
        </button>
      </div>
    </div>
  );
}

export function SheetEditorTable({
  fields,
  register,
  deviceOptions,
  onSaveRow,
  loading,
}: SheetEditorTableProps): JSX.Element {
  const itemData: SheetEditorRowData = {
    fields,
    register,
    deviceOptions,
    onSaveRow,
  };

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] p-2">
      <SheetEditorHeader />

      {loading ? (
        <div className="p-4 text-sm text-[var(--muted)]">Loading sheet...</div>
      ) : (
        <List
          height={360}
          itemCount={fields.length}
          itemSize={54}
          width="100%"
          itemData={itemData}
        >
          {SheetEditorRow}
        </List>
      )}
    </div>
  );
}
