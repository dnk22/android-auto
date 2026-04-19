import { useMemo } from "react";

import { useAutomationStore } from "../store/automation.store";

export function CommonConfig(): JSX.Element {
  const config = useAutomationStore((state) => state.config);
  const setConfig = useAutomationStore((state) => state.setConfig);

  const hasCommonHashtag = useMemo(() => Boolean(config.hashtagCommon?.trim()), [config.hashtagCommon]);

  return (
    <section className="card fade-in rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Common Config</h2>
        <span className="rounded-full bg-[var(--chip-muted-bg)] px-2 py-1 text-xs text-[var(--chip-muted-fg)]">Local override</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)]">hashtagCommon</span>
          <input
            value={config.hashtagCommon ?? ""}
            onChange={(event) =>
              setConfig({
                ...config,
                hashtagCommon: event.target.value || undefined,
              })
            }
            placeholder="#shopee #upload"
            className="rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--accent-2)]"
          />
          <span className="text-[11px] text-[var(--muted)]">
            {hasCommonHashtag ? "Inline hashtag will be ignored while common hashtag is set." : "Inline hashtag is required per row when common hashtag is empty."}
          </span>
        </label>

        <label className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--panel-soft)] px-3 py-2">
          <span className="text-sm text-[var(--ink)]">autoReady</span>
          <button
            type="button"
            onClick={() => setConfig({ ...config, autoReady: !config.autoReady })}
            className={`relative h-6 w-12 rounded-full transition-colors ${
              config.autoReady ? "bg-[var(--accent-2)]" : "bg-[var(--chip-muted-bg)]"
            }`}
            aria-pressed={config.autoReady}
          >
            <span
              className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${
                config.autoReady ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      </div>
    </section>
  );
}
