import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { InvitePreview } from '../types/delegation';

export function usePublicInvite(token: string | undefined) {
  const apiClient = useApiClient();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setError('Missing invite token');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void (async () => {
      try {
        const res = await apiClient.get(`/invite/${token}`);
        if (cancelled) return;
        if (res.data.success === false) {
          setError(res.data.error || 'Invite not found');
          setPreview(null);
        } else {
          setPreview({
            business_name: res.data.business_name,
            location_name: res.data.location_name,
            inviter_first_name: res.data.inviter_first_name,
            expires_at: res.data.expires_at,
            needs_name: res.data.needs_name,
            role_name: res.data.role_name,
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        setPreview(null);
        setError(
          err?.response?.data?.error ||
            err?.message ||
            'Invite not found or expired'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, token]);

  const accept = useCallback(
    async (names?: { first_name?: string; last_name?: string }) => {
      if (!token) throw new Error('Missing token');
      setAccepting(true);
      try {
        const res = await apiClient.post(`/invite/${token}/accept`, names || {});
        return res.data as {
          success: boolean;
          already_authenticated: boolean;
          email: string;
        };
      } finally {
        setAccepting(false);
      }
    },
    [apiClient, token]
  );

  return { preview, loading, error, accepting, accept };
}
