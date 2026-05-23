import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FilterSearch } from "iconsax-reactjs";

import { getExecutionAutoLog } from "../../../../automation/api/automation.api";
import type {
  AutoLogEvent,
  AutoLogLevel,
  ExecutionAutoLogResponse,
  StorageWsEvent,
} from "../../../../automation/types/automation.types";

function isAutoLogAddedEvent(
  event: StorageWsEvent,
): event is StorageWsEvent & { payload: AutoLogEvent } {
  return event.event === "auto_log_added";
}

function formatTime(ts?: number | null): string {
  if (!ts) {
    return "-";
  }
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function getLevelClass(level: AutoLogLevel): string {
  switch (level) {
    case "debug":
      return "bg-slate-600 text-white";
    case "info":
      return "bg-blue-600 text-white";
    case "success":
      return "bg-emerald-600 text-white";
    case "warning":
      return "bg-amber-600 text-white";
    case "error":
      return "bg-rose-700 text-white";
    default:
      return "bg-slate-600 text-white";
  }
}

type DeviceAutoLogPanelProps = {
  deviceId: string;
  wsUrl?: string;
  executionOptions: string[];
  defaultExecutionId: string;
};

export default function DeviceAutoLogPanel({
  deviceId,
  wsUrl,
  executionOptions,
  defaultExecutionId,
}: DeviceAutoLogPanelProps): JSX.Element {
  const [selectedExecutionId, setSelectedExecutionId] = useState("");
  const [logs, setLogs] = useState<AutoLogEvent[]>([]);
  const [levelFilter, setLevelFilter] = useState<"all" | AutoLogLevel>("all");
  const [search, setSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const logPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedExecutionId && defaultExecutionId) {
      setSelectedExecutionId(defaultExecutionId);
    }
  }, [defaultExecutionId, selectedExecutionId]);

  useEffect(() => {
    if (!selectedExecutionId && executionOptions.length > 0) {
      setSelectedExecutionId(executionOptions[0] ?? "");
    }
    if (selectedExecutionId && !executionOptions.includes(selectedExecutionId)) {
      setSelectedExecutionId(executionOptions[0] ?? "");
    }
  }, [executionOptions, selectedExecutionId]);

  const query = useQuery({
    queryKey: ["automation", "executions", "auto-log", selectedExecutionId],
    queryFn: () => getExecutionAutoLog(selectedExecutionId),
    enabled: Boolean(selectedExecutionId),
    staleTime: 5_000,
  });

  useEffect(() => {
    const payload = query.data as ExecutionAutoLogResponse | undefined;
    if (!payload) {
      return;
    }
    setLogs(payload.logs ?? []);
  }, [query.data]);

  useEffect(() => {
    if (!wsUrl || !selectedExecutionId) {
      return;
    }

    let socket: WebSocket | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) {
        return;
      }
      socket = new WebSocket(wsUrl);
      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as StorageWsEvent;
          if (isAutoLogAddedEvent(event)) {
            if (event.payload.executionId !== selectedExecutionId) {
              return;
            }
            setLogs((prev) => [...prev, event.payload]);
          }
        } catch {
          return;
        }
      };
      socket.onclose = () => {
        if (stopped) {
          return;
        }
        window.setTimeout(connect, 1000);
      };
    };

    connect();
    return () => {
      stopped = true;
      socket?.close();
      socket = null;
    };
  }, [selectedExecutionId, wsUrl]);

  useEffect(() => {
    if (!logPanelRef.current) {
      return;
    }
    logPanelRef.current.scrollTop = logPanelRef.current.scrollHeight;
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return logs.filter((item) => {
      if (item.deviceId !== deviceId) {
        return false;
      }
      if (onlyErrors && item.level !== "error") {
        return false;
      }
      if (levelFilter !== "all" && item.level !== levelFilter) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      const blob = [
        item.message,
        item.event,
        item.stepName ?? "",
        item.stepKey ?? "",
        item.deviceId ?? "",
        item.reason ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(keyword);
    });
  }, [deviceId, levelFilter, logs, onlyErrors, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col border-l border-[var(--card-border)] bg-[var(--panel-soft)]">
      <div className="flex items-center justify-between border-b border-[var(--card-border)] px-3 py-2">
        <p className="text-xs font-semibold text-[var(--ink)]">Logs</p>
        <button
          type="button"
          onClick={() => setShowFilters((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--card-border)] px-2 py-1 text-[10px] font-semibold text-[var(--ink)]"
        >
          <FilterSearch size="14" color="currentColor" variant="Linear" />
          Filter
        </button>
      </div>

      <div className="border-b border-[var(--card-border)] px-3 py-2">
        <select
          value={selectedExecutionId}
          onChange={(event) => setSelectedExecutionId(event.target.value)}
          className="w-full rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1 text-[10px]"
        >
          <option value="">Execution</option>
          {executionOptions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      </div>

      {showFilters ? (
        <div className="space-y-2 border-b border-[var(--card-border)] px-3 py-2 text-[10px]">
          <select
            value={levelFilter}
            onChange={(event) =>
              setLevelFilter(event.target.value as "all" | AutoLogLevel)
            }
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1"
          >
            <option value="all">Level: all</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="success">success</option>
            <option value="warning">warning</option>
            <option value="error">error</option>
          </select>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search message/event"
            className="w-full rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1"
          />
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(event) => setOnlyErrors(event.target.checked)}
            />
            Only errors
          </label>
        </div>
      ) : null}

      <div
        ref={logPanelRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 text-[10px]"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-[var(--muted)]">Chưa có log nào</p>
        ) : (
          filteredLogs.map((item) => (
            <div
              key={`${item.id}-${item.createdAt}`}
              className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-2"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase ${getLevelClass(item.level)}`}
                >
                  {item.level}
                </span>
                <span className="text-[10px] text-[var(--muted)]">
                  {formatTime(item.createdAt)}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--ink)]">{item.message}</p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {item.event} | step: {item.stepName || item.stepKey || "-"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
