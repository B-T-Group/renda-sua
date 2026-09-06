import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import { useStore } from '../stores/RootStore';

/**
 * Tracks whether the agent is available for new orders. Seeded from `/users/me`
 * (`agent.is_available`, defaulting to true) and persisted via the backend.
 * Turning availability off is rejected by the backend while the agent has
 * active orders; that error is surfaced through `error`.
 */
export function useAgentAvailability() {
  const { auth, persona } = useStore();
  const enabled =
    auth.isAuthenticated &&
    !!auth.user?.id &&
    persona.showMainApp &&
    persona.activePersona === 'agent';

  const [available, setAvailableState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    const res = await agentApi.users.getMe();
    setAvailableState(res.user?.agent?.is_available ?? true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        await fetchAvailability();
      } catch {
        if (!cancelled) setAvailableState(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, fetchAvailability]);

  const setAvailable = useCallback(async (next: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const res = await agentApi.agents.setAvailability(next);
      setAvailableState(res.agent?.is_available ?? next);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update availability');
      throw e;
    } finally {
      setSaving(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { enabled, available, loading, saving, error, setAvailable, clearError };
}
