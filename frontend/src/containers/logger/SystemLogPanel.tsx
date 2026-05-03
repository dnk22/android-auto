import { useEffect, useMemo, useRef, useState } from "react";
import type { SystemLogEvent, SystemLogLevel, SystemLogService } from "./types";

type Props = {
  logs: SystemLogEvent[];
  onClear: () => void;
};

type LevelFilter = "all" | SystemLogLevel;
type ServiceFilter = "all" | SystemLogService;

type PersistedSystemLogFilters = {
  search: string;
  level: LevelFilter;
  service: ServiceFilter;
  component: string;
  deviceId: string;
  onlyErrors: boolean;
};

const FILTER_STORAGE_KEY = "system_log_filters_v1";
const ALLOWED_LEVELS: ReadonlySet<string> = new Set([
  "all",
  "debug",
  "info",
  "success",
  "warning",
  "error",
]);
const ALLOWED_SERVICES: ReadonlySet<string> = new Set([
  "all",
  "orchestrator",
  "automation",
  "media",
  "unknown",
]);

const levelClassMap: Record<SystemLogLevel, string> = {
  debug: "bg-slate-600 text-white",
  info: "bg-blue-600 text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-600 text-white",
  error: "bg-rose-700 text-white",
};

const toSearchBlob = (log: SystemLogEvent): string => {
  let metaStr = "";
  try {
    metaStr = JSON.stringify(log.meta ?? {});
  } catch {
    metaStr = "";
  }

  return [
    log.message,
    log.event,
    log.service,
    log.component ?? "",
    log.deviceId ?? "",
    metaStr,
  ]
    .join(" ")
    .toLowerCase();
};

const formatTime = (ts: number): string => {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

const stringifyPretty = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const readPersistedFilters = (): PersistedSystemLogFilters | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nextLevel = String(parsed.level ?? "all");
    const nextService = String(parsed.service ?? "all");

    return {
      search: typeof parsed.search === "string" ? parsed.search : "",
      level: (ALLOWED_LEVELS.has(nextLevel) ? nextLevel : "all") as LevelFilter,
      service: (ALLOWED_SERVICES.has(nextService) ? nextService : "all") as ServiceFilter,
      component: typeof parsed.component === "string" && parsed.component ? parsed.component : "all",
      deviceId: typeof parsed.deviceId === "string" && parsed.deviceId ? parsed.deviceId : "all",
      onlyErrors: Boolean(parsed.onlyErrors),
    };
  } catch {
    return null;
  }
};

export function SystemLogPanel({ logs, onClear }: Props): JSX.Element {
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [service, setService] = useState<ServiceFilter>("all");
  const [component, setComponent] = useState("all");
  const [deviceId, setDeviceId] = useState("all");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [hydrated, setHydrated] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);

  const componentOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.component).filter(Boolean))),
    [logs],
  );

  const deviceOptions = useMemo(
    () => Array.from(new Set(logs.map((item) => item.deviceId).filter(Boolean))),
    [logs],
  );

  useEffect(() => {
    const persisted = readPersistedFilters();
    if (persisted) {
      setSearch(persisted.search);
      setLevel(persisted.level);
      setService(persisted.service);
      setComponent(persisted.component);
      setDeviceId(persisted.deviceId);
      setOnlyErrors(persisted.onlyErrors);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") {
      return;
    }

    const payload: PersistedSystemLogFilters = {
      search,
      level,
      service,
      component,
      deviceId,
      onlyErrors,
    };

    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(payload));
  }, [component, deviceId, hydrated, level, onlyErrors, search, service]);

  useEffect(() => {
    if (component !== "all" && !componentOptions.includes(component)) {
      setComponent("all");
    }
  }, [component, componentOptions]);

  useEffect(() => {
    if (deviceId !== "all" && !deviceOptions.includes(deviceId)) {
      setDeviceId("all");
    }
  }, [deviceId, deviceOptions]);

  const filteredLogs = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return logs.filter((item) => {
      if (onlyErrors && item.level !== "error") {
        return false;
      }
      if (level !== "all" && item.level !== level) {
        return false;
      }
      if (service !== "all" && item.service !== service) {
        return false;
      }
      if (component !== "all" && (item.component ?? "") !== component) {
        return false;
      }
      if (deviceId !== "all" && (item.deviceId ?? "") !== deviceId) {
        return false;
      }
      if (!keyword) {
        return true;
      }

      return toSearchBlob(item).includes(keyword);
    });
  }, [component, deviceId, level, logs, onlyErrors, search, service]);

  useEffect(() => {
    if (!panelRef.current) {
      return;
    }
    panelRef.current.scrollTop = panelRef.current.scrollHeight;
  }, [filteredLogs]);

  const toggleExpanded = (id: string): void => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleClear = (): void => {
    setExpandedIds({});
    onClear();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-6">
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search message/event/service/component/device/meta"
          className="xl:col-span-2 rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none"
        />

        <select
          value={level}
          onChange={(event) => {
            setLevel(event.target.value as LevelFilter);
          }}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
        >
          <option value="all">Level: all</option>
          <option value="debug">debug</option>
          <option value="info">info</option>
          <option value="success">success</option>
          <option value="warning">warning</option>
          <option value="error">error</option>
        </select>

        <select
          value={service}
          onChange={(event) => {
            setService(event.target.value as ServiceFilter);
          }}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
        >
          <option value="all">Service: all</option>
          <option value="orchestrator">orchestrator</option>
          <option value="automation">automation</option>
          <option value="media">media</option>
          <option value="unknown">unknown</option>
        </select>

        <select
          value={component}
          onChange={(event) => {
            setComponent(event.target.value);
          }}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
        >
          <option value="all">Component: all</option>
          {componentOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          value={deviceId}
          onChange={(event) => {
            setDeviceId(event.target.value);
          }}
          className="rounded-md border border-[var(--card-border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--ink)]"
        >
          <option value="all">Device: all</option>
          {deviceOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={(event) => {
              setOnlyErrors(event.target.checked);
            }}
          />
          Only errors
        </label>
        <span>
          Showing {filteredLogs.length} / {logs.length}
        </span>
        <button
          type="button"
          onClick={handleClear}
          className="rounded-md border border-[var(--card-border)] px-2 py-1 text-[var(--ink)]"
        >
          Clear logs
        </button>
      </div>

      <div
        ref={panelRef}
        className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--panel-soft)] px-3 py-3 text-xs text-[var(--ink)]"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-[var(--muted)]">Waiting for logs...</p>
        ) : (
          filteredLogs.map((item) => {
            const isExpanded = Boolean(expandedIds[item.id]);
            const levelClass = levelClassMap[item.level];
            const componentLabel = item.component ? `/${item.component}` : "";
            const hasDetail = Boolean(item.meta && Object.keys(item.meta).length > 0) || item.raw != null;

            return (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--card-border)] bg-[var(--surface)] px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[var(--muted)]">{formatTime(item.ts)}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${levelClass}`}>
                    {item.level}
                  </span>
                  <span className="font-mono text-[var(--muted)]">
                    {item.service}
                    {componentLabel}
                  </span>
                  {item.deviceId ? (
                    <span className="rounded border border-[var(--card-border)] px-1.5 py-0.5 font-mono text-[10px]">
                      {item.deviceId}
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 text-sm text-[var(--ink)]">{item.message}</div>
                {item.event && item.event !== item.message ? (
                  <div className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">{item.event}</div>
                ) : null}

                {hasDetail ? (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        toggleExpanded(item.id);
                      }}
                      className="rounded-md border border-[var(--card-border)] px-2 py-0.5 text-[11px]"
                    >
                      {isExpanded ? "Collapse" : "Expand"}
                    </button>
                  </div>
                ) : null}

                {isExpanded ? (
                  <div className="mt-2 grid gap-2">
                    <div>
                      <p className="mb-1 text-[10px] uppercase text-[var(--muted)]">meta</p>
                      <pre className="overflow-x-auto rounded bg-black/10 p-2 font-mono text-[11px]">
                        {stringifyPretty(item.meta ?? {})}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] uppercase text-[var(--muted)]">raw</p>
                      <pre className="overflow-x-auto rounded bg-black/10 p-2 font-mono text-[11px]">
                        {stringifyPretty(item.raw)}
                      </pre>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
