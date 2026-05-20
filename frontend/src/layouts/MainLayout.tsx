import { useState } from "react";
import { Outlet } from "react-router-dom";

import SidebarMenu from "../components/menu/SidebarMenu";
import { useStore } from "../store/useStore";

const SIDEBAR_EXPANDED_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 80;

export default function MainLayout(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false);
  const theme = useStore((state) => state.theme);
  const toggleTheme = useStore((state) => state.toggleTheme);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-start)]">
      <aside
        className="flex h-full flex-col border-r border-[var(--card-border)] bg-[var(--panel)] transition-all duration-200"
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
        }}
      >
        <div
          className={[
            "border-b border-[var(--card-border)] p-2",
            collapsed
              ? "flex flex-col items-center gap-2"
              : "flex items-center justify-between gap-2",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={toggleTheme}
            className="h-10 w-12 rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] px-2 py-2 text-xs font-semibold text-[var(--ink)] transition-colors hover:opacity-90"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {collapsed
              ? theme === "dark"
                ? "L"
                : "D"
              : theme === "dark"
                ? "Light"
                : "Dark"}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="h-10 w-12 rounded-md border border-[var(--card-border)] bg-[var(--panel-soft)] text-lg text-[var(--ink)] transition-colors hover:opacity-90"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? "☰" : "←"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarMenu collapsed={collapsed} />
        </div>
      </aside>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
