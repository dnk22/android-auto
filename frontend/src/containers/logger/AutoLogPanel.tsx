import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getExecutionAutoLog } from "../../automation/api/automation.api";
import { useStorage } from "../../automation/hooks/useStorage";
import type {
  AutoExecutionStep,
  AutoLogEvent,
  AutoLogLevel,
  ExecutionAutoLogResponse,
  StorageWsEvent,
} from "../../automation/types/automation.types";

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

function isAutoLogAddedEvent(
  event: StorageWsEvent,
): event is StorageWsEvent & { payload: AutoLogEvent } {
  return event.event === "auto_log_added";
}

function isAutoStepUpdatedEvent(
  event: StorageWsEvent,
): event is StorageWsEvent & { payload: AutoExecutionStep } {
  return event.event === "auto_step_updated";
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

function getStepBadgeClass(status: AutoExecutionStep["status"]): string {
  switch (status) {
    case "running":
      return "bg-blue-600 text-white";
    case "done":
      return "bg-emerald-600 text-white";
    case "error":
      return "bg-rose-700 text-white";
    case "stopped":
      return "bg-amber-600 text-white";
    case "skipped":
      return "bg-slate-500 text-white";
    default:
      return "bg-slate-300 text-slate-800";
  }
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

function mergeStep(
  prev: AutoExecutionStep[],
  nextStep: AutoExecutionStep,
): AutoExecutionStep[] {
  const index = prev.findIndex(
    (item) => item.id === nextStep.id || item.stepIndex === nextStep.stepIndex,
  );
  if (index === -1) {
    return [...prev, nextStep].sort((a, b) => a.stepIndex - b.stepIndex);
  }
  const next = [...prev];
  next[index] = nextStep;
  return next;
}

export function AutoLogPanel(): JSX.Element {
  const { rows, wsUrl } = useStorage();

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

  const [selectedExecutionId, setSelectedExecutionId] = useState<string>("");
  const [steps, setSteps] = useState<AutoExecutionStep[]>([]);
  const [logs, setLogs] = useState<AutoLogEvent[]>([]);

  const [deviceFilter, setDeviceFilter] = useState("all");
  const [stepFilter, setStepFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState<"all" | AutoLogLevel>("all");
  const [search, setSearch] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);

  const logPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!selectedExecutionId && executionOptions.length > 0) {
      setSelectedExecutionId(executionOptions[0] ?? "");
      return;
    }
    if (
      selectedExecutionId &&
      !executionOptions.includes(selectedExecutionId)
    ) {
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
    setSteps(payload.steps ?? []);
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
            return;
          }
          if (isAutoStepUpdatedEvent(event)) {
            if (event.payload.executionId !== selectedExecutionId) {
              return;
            }
            setSteps((prev) => mergeStep(prev, event.payload));
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

  const deviceOptions = useMemo(
    () =>
      Array.from(
        new Set(logs.map((item) => item.deviceId).filter(Boolean)),
      ) as string[],
    [logs],
  );

  const stepOptions = useMemo(
    () =>
      Array.from(
        new Set(logs.map((item) => item.stepKey).filter(Boolean)),
      ) as string[],
    [logs],
  );

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return logs.filter((item) => {
      if (onlyErrors && item.level !== "error") {
        return false;
      }
      if (levelFilter !== "all" && item.level !== levelFilter) {
        return false;
      }
      if (deviceFilter !== "all" && (item.deviceId ?? "") !== deviceFilter) {
        return false;
      }
      if (stepFilter !== "all" && (item.stepKey ?? "") !== stepFilter) {
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
  }, [deviceFilter, levelFilter, logs, onlyErrors, search, stepFilter]);

  const currentExecution = query.data?.execution;

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 text-xs text-[var(--ink)]">
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
        <select
          value={selectedExecutionId}
          onChange={(event) => setSelectedExecutionId(event.target.value)}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5"
        >
          <option value="">Execution: chọn execution</option>
          {executionOptions.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>

        <select
          value={deviceFilter}
          onChange={(event) => setDeviceFilter(event.target.value)}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5"
        >
          <option value="all">Device: all</option>
          {deviceOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={stepFilter}
          onChange={(event) => setStepFilter(event.target.value)}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5"
        >
          <option value="all">Step: all</option>
          {stepOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={levelFilter}
          onChange={(event) =>
            setLevelFilter(event.target.value as "all" | AutoLogLevel)
          }
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5"
        >
          <option value="all">Level: all</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="success">success</option>
          <option value="warning">warning</option>
          <option value="error">error</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search message/event/step/device/reason"
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 lg:col-span-2"
        />

        <label className="inline-flex items-center gap-2 rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(event) => setOnlyErrors(event.target.checked)}
          />
          Only errors
        </label>
      </div>

      <div className="grid  flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
        <div className="min-h-0 overflow-y-auto rounded-xl bg-[var(--panel-soft)] px-3 py-3">
          <p className="mb-2 font-semibold">Steps</p>
          {steps.length === 0 ? (
            <p className="text-[var(--muted)]">Chưa có steps.</p>
          ) : (
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={`${step.executionId}-${step.stepIndex}`}
                  className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {step.stepIndex}. {step.stepName}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getStepBadgeClass(step.status)}`}
                    >
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--muted)]">
                    key: {step.stepKey} | device: {step.deviceId || "-"} |{" "}
                    {formatTime(step.startedAt)} - {formatTime(step.finishedAt)}
                  </p>
                  {step.errorMessage ? (
                    <p className="mt-1 text-[11px] text-rose-500">
                      {step.errorMessage}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          ref={logPanelRef}
          className="min-h-0 space-y-2 overflow-y-auto rounded-xl bg-[var(--panel-soft)] px-3 py-3"
        >
          <p className="mb-2 font-semibold">Timeline</p>
          {filteredLogs.length === 0 ? (
            <p className="text-[var(--muted)]">Waiting for auto logs...</p>
          ) : (
            filteredLogs.map((item) => (
              <div
                key={`${item.id}-${item.createdAt}`}
                className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getLevelClass(item.level)}`}
                  >
                    {item.level}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {formatTime(item.createdAt)}
                  </span>
                  <span className="text-[11px] text-[var(--muted)]">
                    {item.event}
                  </span>
                </div>
                <p className="mt-1 text-[12px]">{item.message}</p>
                <p className="mt-1 text-[11px] text-[var(--muted)]">
                  step: {item.stepName || item.stepKey || "-"} | device:{" "}
                  {item.deviceId || "-"}{" "}
                  {item.reason ? `| reason: ${item.reason}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
