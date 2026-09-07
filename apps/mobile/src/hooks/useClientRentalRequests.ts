import { useCallback, useEffect, useState } from 'react';
import { cancelRequest, getClientRequests } from '../services/rentalsApi';
import type { ClientRentalRequestRow } from '../types/rentals';

export function useClientRentalRequests(enabled = true) {
  const [requests, setRequests] = useState<ClientRentalRequestRow[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await getClientRequests();
      setRequests(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const cancel = useCallback(
    async (requestId: string) => {
      setCancellingId(requestId);
      try {
        const res = await cancelRequest(requestId);
        if (!res.success) {
          throw new Error(res.message || 'Cancel failed');
        }
        await refetch();
        return res;
      } finally {
        setCancellingId(null);
      }
    },
    [refetch]
  );

  return { requests, loading, error, refetch, cancel, cancellingId };
}
