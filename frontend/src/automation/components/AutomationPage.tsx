import { CommonConfig } from "./CommonConfig";
import { AutomationTable } from "./AutomationTable";
import { useAutomationSheet } from "../hooks/useAutomationSheet";

export function AutomationPage(): JSX.Element {
  const { loading, error, isRefetching } = useAutomationSheet();

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4">
      <CommonConfig />

      {loading ? (
        <div className="card rounded-2xl p-4 text-sm text-[var(--muted)]">Loading automation sheet...</div>
      ) : (
        <AutomationTable />
      )}

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          Failed to load automation data.
        </div>
      ) : null}

      {isRefetching ? <p className="text-xs text-[var(--muted)]">Syncing with backend...</p> : null}
    </section>
  );
}
