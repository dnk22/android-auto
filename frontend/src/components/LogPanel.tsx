import { useState } from "react";

import { AutoLogPanel } from "../containers/logger/AutoLogPanel";
import { SystemLogPanel } from "../containers/logger/SystemLogPanel";
import { useStore } from "../store/useStore";

type LogTab = "system" | "auto";

export default function LogPanel(): JSX.Element {
  const logs = useStore((state) => state.logs);
  const clearLogs = useStore((state) => state.clearLogs);
  const [activeTab, setActiveTab] = useState<LogTab>("system");

  return (
    <section className="card fade-in flex h-full min-h-0 flex-col p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Logs</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("system");
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === "system"
                ? "bg-[var(--accent-2)] text-white"
                : "border border-[var(--card-border)] text-[var(--ink)]"
            }`}
          >
            Hệ thống
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("auto");
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              activeTab === "auto"
                ? "bg-[var(--accent-2)] text-white"
                : "border border-[var(--card-border)] text-[var(--ink)]"
            }`}
          >
            Auto Log
          </button>
        </div>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {activeTab === "system" ? (
          <SystemLogPanel logs={logs} onClear={clearLogs} />
        ) : (
          <AutoLogPanel />
        )}
      </div>
    </section>
  );
}
