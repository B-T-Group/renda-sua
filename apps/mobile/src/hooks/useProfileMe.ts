import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { MeResponse, MeUser } from '../types/me';

export function useProfileMe(enabled = true) {
  const [me, setMe] = useState<MeUser | null>(null);
  const [auth0User, setAuth0User] = useState<MeResponse['auth0User']>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (options?: { silent?: boolean }) => {
    if (!enabled) return;
    if (!options?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await agentApi.users.getMe();
      if (!res.success || !res.user) {
        throw new Error(res.message || 'Failed to load profile');
      }
      setMe(res.user);
      setAuth0User(res.auth0User);
      return res;
    } catch (e: unknown) {
      if (!options?.silent) {
        setError(e instanceof Error ? e.message : 'Error');
        setMe(null);
        setAuth0User(undefined);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);

  return { me, auth0User, loading, error, refetch };
}
