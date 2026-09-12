import { useCallback, useEffect, useRef, useState } from 'react';

export type DashboardComposingPersona =
  | 'client'
  | 'agent'
  | 'business'
  | 'delegate';

const STORAGE_PREFIX = 'rendasua.dashboardComposing.seen.';
export const DASHBOARD_COMPOSING_MIN_MS = 1200;

function storageKey(persona: DashboardComposingPersona): string {
  return `${STORAGE_PREFIX}${persona}`;
}

export function hasSeenDashboardComposing(
  persona: DashboardComposingPersona
): boolean {
  try {
    return sessionStorage.getItem(storageKey(persona)) === '1';
  } catch {
    return false;
  }
}

export function markDashboardComposingSeen(
  persona: DashboardComposingPersona
): void {
  try {
    sessionStorage.setItem(storageKey(persona), '1');
  } catch {
    // Ignore private-mode / blocked storage.
  }
}

/**
 * First home paint of a persona in this browser tab: show composing overlay
 * until loading finishes and the minimum display time has elapsed.
 */
export function useDashboardComposingSession(
  persona: DashboardComposingPersona | null | undefined,
  isLoading: boolean
): { showComposing: boolean } {
  const [showComposing, setShowComposing] = useState(false);
  const startedAt = useRef<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  useEffect(() => {
    if (!persona) {
      setShowComposing(false);
      return;
    }

    if (isLoading && !hasSeenDashboardComposing(persona)) {
      if (startedAt.current == null) {
        startedAt.current = Date.now();
      }
      setShowComposing(true);
      return;
    }

    if (!showComposing) {
      return;
    }

    const elapsed = Date.now() - (startedAt.current ?? Date.now());
    const remaining = Math.max(0, DASHBOARD_COMPOSING_MIN_MS - elapsed);

    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      markDashboardComposingSeen(persona);
      setShowComposing(false);
      startedAt.current = null;
    }, remaining);

    return clearHideTimer;
  }, [persona, isLoading, showComposing, clearHideTimer]);

  useEffect(() => clearHideTimer, [clearHideTimer]);

  return { showComposing };
}
