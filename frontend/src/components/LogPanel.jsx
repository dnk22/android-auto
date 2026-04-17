import { useEffect, useRef } from "react";

import { useStore } from "../store/useStore.js";

export default function LogPanel() {
  const logs = useStore((state) => state.logs);
  const panelRef = useRef(null);

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <section className="card fade-in flex h-full min-h-0 flex-col p-6 max-h-[50vh]">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Live Logs</h3>
        <span className="rounded-full bg-[var(--chip-success-bg)] px-3 py-1 text-xs text-[var(--chip-success-fg)]">
          Streaming
        </span>
      </div>
      <div
        ref={panelRef}
        className="mt-4 flex-1 space-y-2 overflow-y-auto rounded-xl bg-[var(--panel-soft)] px-4 py-3 text-xs text-[var(--ink)]"
      >
        {logs.length === 0 ? (
          <p className="text-[var(--muted)]">Waiting for logs...</p>
        ) : (
          logs.map((line, index) => (
            <p key={`${line}-${index}`} className="font-mono">
              {line}
            </p>
          ))
        )}
      </div>
    </section>
  );
}
