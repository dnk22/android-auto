import type { SessionToolbarAction } from "../../types/automation/editor.types";

export const SESSION_TOOLBAR_ACTION = {
  WATCHING: "watching",
  IDLE: "idle",
  TOGGLE_AUTO_READY: "toggle-auto-ready",
} as const satisfies Record<string, SessionToolbarAction>;
