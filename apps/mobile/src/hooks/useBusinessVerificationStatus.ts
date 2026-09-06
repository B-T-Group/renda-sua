import { useCallback, useEffect, useState } from 'react';
import {
  businessVerificationApi,
  type BusinessVerificationStatus,
} from '../services/businessVerificationApi';

export function useBusinessVerificationStatus(enabled = true) {
  const [status, setStatus] = useState<BusinessVerificationStatus | null>(null);
  // Start true so consumers do not flash full UI before the first fetch.
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await businessVerificationApi.getStatus();
      if (res.success) setStatus(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { status, loading, error, refetch };
}
