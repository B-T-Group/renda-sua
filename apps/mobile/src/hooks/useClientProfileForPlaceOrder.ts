import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { MeUser } from '../types/me';

export function useClientProfileForPlaceOrder() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.users.getMe();
      if (res.success && res.user?.id) {
        setUser(res.user);
      } else {
        setUser(null);
        setError(res.message ?? null);
      }
    } catch (e: unknown) {
      setUser(null);
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { user, loading, error, refetch: load };
}
