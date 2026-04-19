import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSession } from "../api/automation.api";
import {
  SESSION_QUERY_KEY,
  useSessionActionMutation,
} from "../store/automation.mutations.store";
import { SESSION_TOOLBAR_ACTION } from "../utils/sessionToolbar.constants";
import type { SessionToolbarAction } from "../../types/automation/editor.types";
import type { SessionStatus } from "../types/automation.types";

export function useSessionToolbar(): {
  sessionStatusText: string;
  autoReadyText: string;
  isWatching: boolean;
  isAutoReady: boolean;
  handleWatching: () => void;
  handleIdle: () => void;
  handleAutoReady: () => void;
  isLoading: boolean;
} {
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
  });

  const session = sessionQuery.data;
  const sessionActionMutation = useSessionActionMutation();

  const runSessionAction = useCallback(
    (action: SessionToolbarAction): void => {
      if (action === SESSION_TOOLBAR_ACTION.TOGGLE_AUTO_READY) {
        sessionActionMutation.mutate({
          autoReady: !Boolean(session?.autoReady),
        });
        return;
      }

      const status = action as SessionStatus;
      sessionActionMutation.mutate({ status });
    },
    [session?.autoReady, sessionActionMutation],
  );

  const handleWatching = useCallback(() => {
    runSessionAction(SESSION_TOOLBAR_ACTION.WATCHING);
  }, [runSessionAction]);

  const handleIdle = useCallback(() => {
    runSessionAction(SESSION_TOOLBAR_ACTION.IDLE);
  }, [runSessionAction]);

  const handleAutoReady = useCallback(() => {
    runSessionAction(SESSION_TOOLBAR_ACTION.TOGGLE_AUTO_READY);
  }, [runSessionAction]);

  return useMemo(
    () => ({
      sessionStatusText:
        session?.status === SESSION_TOOLBAR_ACTION.IDLE
          ? "Tạm dừng"
          : "Đang chạy",
      autoReadyText: session?.autoReady ? "Mở" : "Tắt",
      isWatching: session?.status === SESSION_TOOLBAR_ACTION.WATCHING,
      isAutoReady: Boolean(session?.autoReady),
      handleWatching,
      handleIdle,
      handleAutoReady,
      isLoading: sessionQuery.isLoading,
    }),
    [
      handleAutoReady,
      handleIdle,
      handleWatching,
      sessionQuery.isLoading,
      session?.autoReady,
      session?.status,
    ],
  );
}
