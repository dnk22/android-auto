import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { getSession } from "../api/automation.api";
import {
  SESSION_QUERY_KEY,
  useCreateVideoFolderMutation,
  useSessionActionMutation,
} from "../store/automation.mutations.store";
import { SESSION_TOOLBAR_ACTION } from "../utils/sessionToolbar.constants";
import type { SessionToolbarAction } from "../../types/automation/editor.types";
import type { SessionState, SessionStatus } from "../types/automation.types";

const normalizeHashtagCommon = (value: string | null | undefined): string =>
  (value ?? "").trim();

export function useSessionToolbar(): {
  sessionStatusText: string;
  autoReadyText: string;
  isWatching: boolean;
  isAutoReady: boolean;
  hashtagCommonValue: string;
  isHashtagCommonDisabled: boolean;
  isVideoFolderCreated: boolean;
  handleWatching: () => void;
  handleIdle: () => void;
  handleAutoReady: () => void;
  handleHashtagCommonChange: (value: string) => void;
  submitHashtagCommon: () => void;
  clearHashtagCommon: () => void;
  createVideoFolderAt: (isDesktop: boolean) => Promise<void>;
  isCreatingVideoFolder: boolean;
  isLoading: boolean;
} {
  const sessionQuery = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: getSession,
  });

  const session = sessionQuery.data;
  const [sessionLocal, setSessionLocal] = useState<SessionState | null>(null);
  const sessionActionMutation = useSessionActionMutation();
  const createVideoFolderMutation = useCreateVideoFolderMutation();
  const [hashtagCommonDraft, setHashtagCommonDraft] = useState("");
  const hashtagTimerRef = useRef<number | null>(null);
  const normalizedSessionHashtagRef = useRef("");
  const resolvedSession = sessionLocal ?? session;

  useEffect(() => {
    if (!session) {
      return;
    }
    setSessionLocal(session);
  }, [session]);

  useEffect(() => {
    if (!resolvedSession) {
      return;
    }
    normalizedSessionHashtagRef.current = normalizeHashtagCommon(
      resolvedSession.hashtagCommon,
    );
    setHashtagCommonDraft(resolvedSession.hashtagCommon ?? "");
  }, [resolvedSession]);

  useEffect(() => {
    return () => {
      if (hashtagTimerRef.current !== null) {
        window.clearTimeout(hashtagTimerRef.current);
      }
    };
  }, []);

  const applySessionResponse = useCallback((next: SessionState): void => {
    setSessionLocal(next);
    normalizedSessionHashtagRef.current = normalizeHashtagCommon(next.hashtagCommon);
    setHashtagCommonDraft(next.hashtagCommon ?? "");
  }, []);

  const runSessionAction = useCallback(
    (action: SessionToolbarAction): void => {
      if (action === SESSION_TOOLBAR_ACTION.TOGGLE_AUTO_READY) {
        void sessionActionMutation
          .mutateAsync({
            autoReady: !Boolean(resolvedSession?.autoReady),
          })
          .then(applySessionResponse)
          .catch(() => undefined);
        return;
      }

      const status = action as SessionStatus;
      void sessionActionMutation
        .mutateAsync({ status })
        .then(applySessionResponse)
        .catch(() => undefined);
    },
    [applySessionResponse, resolvedSession?.autoReady, sessionActionMutation],
  );

  const handleWatching = useCallback((): void => {
    runSessionAction(SESSION_TOOLBAR_ACTION.WATCHING);
  }, [runSessionAction]);

  const handleIdle = useCallback(() => {
    runSessionAction(SESSION_TOOLBAR_ACTION.IDLE);
  }, [runSessionAction]);

  const handleAutoReady = useCallback(() => {
    runSessionAction(SESSION_TOOLBAR_ACTION.TOGGLE_AUTO_READY);
  }, [runSessionAction]);

  const handleHashtagCommonChange = useCallback(
    (value: string): void => {
      if (resolvedSession?.status === SESSION_TOOLBAR_ACTION.WATCHING) {
        return;
      }

      setHashtagCommonDraft(value);
    },
    [resolvedSession?.status],
  );

  const scheduleHashtagCommonSubmit = useCallback(
    (value: string): void => {
      if (resolvedSession?.status === SESSION_TOOLBAR_ACTION.WATCHING) {
        return;
      }

      if (hashtagTimerRef.current !== null) {
        window.clearTimeout(hashtagTimerRef.current);
        hashtagTimerRef.current = null;
      }

      const trimmedValue = normalizeHashtagCommon(value);
      if (trimmedValue.length === 0) {
        return;
      }
      if (trimmedValue === normalizedSessionHashtagRef.current) {
        return;
      }

      hashtagTimerRef.current = window.setTimeout(() => {
        void sessionActionMutation
          .mutateAsync({ hashtagCommon: trimmedValue })
          .then(applySessionResponse)
          .catch(() => undefined);
        hashtagTimerRef.current = null;
      }, 400);
    },
    [applySessionResponse, resolvedSession?.status, sessionActionMutation],
  );

  const submitHashtagCommon = useCallback((): void => {
    scheduleHashtagCommonSubmit(hashtagCommonDraft);
  }, [hashtagCommonDraft, scheduleHashtagCommonSubmit]);

  const clearHashtagCommon = useCallback((): void => {
    if (resolvedSession?.status === SESSION_TOOLBAR_ACTION.WATCHING) {
      return;
    }
    if (
      normalizedSessionHashtagRef.current.length === 0
      && hashtagCommonDraft.trim().length === 0
    ) {
      return;
    }

    setHashtagCommonDraft("");
    if (hashtagTimerRef.current !== null) {
      window.clearTimeout(hashtagTimerRef.current);
      hashtagTimerRef.current = null;
    }
    void sessionActionMutation
      .mutateAsync({ hashtagCommon: "" })
      .then(applySessionResponse)
      .catch(() => undefined);
  }, [
    applySessionResponse,
    hashtagCommonDraft,
    resolvedSession?.status,
    sessionActionMutation,
  ]);

  const createVideoFolderAt = useCallback(
    async (isDesktop: boolean): Promise<void> => {
      await createVideoFolderMutation.mutateAsync({ isDesktop });
    },
    [createVideoFolderMutation],
  );

  return useMemo(
    () => ({
      sessionStatusText:
        resolvedSession?.status === SESSION_TOOLBAR_ACTION.IDLE
          ? "Tạm dừng"
          : "Đang chạy",
      autoReadyText: resolvedSession?.autoReady ? "Mở" : "Tắt",
      isWatching: resolvedSession?.status === SESSION_TOOLBAR_ACTION.WATCHING,
      isAutoReady: Boolean(resolvedSession?.autoReady),
      hashtagCommonValue: hashtagCommonDraft,
      isHashtagCommonDisabled: resolvedSession?.status === SESSION_TOOLBAR_ACTION.WATCHING,
      isVideoFolderCreated: Boolean(resolvedSession?.isVideoFolderCreated),
      handleWatching,
      handleIdle,
      handleAutoReady,
      handleHashtagCommonChange,
      submitHashtagCommon,
      clearHashtagCommon,
      createVideoFolderAt,
      isCreatingVideoFolder: createVideoFolderMutation.isPending,
      isLoading: sessionQuery.isLoading || sessionActionMutation.isPending,
    }),
    [
      createVideoFolderAt,
      createVideoFolderMutation.isPending,
      clearHashtagCommon,
      handleAutoReady,
      handleHashtagCommonChange,
      handleIdle,
      handleWatching,
      hashtagCommonDraft,
      submitHashtagCommon,
      sessionActionMutation.isPending,
      sessionQuery.isLoading,
      resolvedSession?.autoReady,
      resolvedSession?.isVideoFolderCreated,
      resolvedSession?.status,
    ],
  );
}
