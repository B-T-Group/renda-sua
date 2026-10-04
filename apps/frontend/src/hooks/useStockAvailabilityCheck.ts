import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';

export type AvailabilityCheckResult =
  | { ok: true }
  | { ok: false; message: string };

function errorMessage(error: unknown): string {
  const data = (error as { response?: { data?: { message?: unknown } } })
    ?.response?.data;
  const raw = data?.message;
  if (typeof raw === 'string' && raw.trim()) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return '';
}

export function useStockAvailabilityCheck(inventoryId: string | null) {
  const apiClient = useApiClient();
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    lock.current = false;
    setPending(false);
    setSending(false);
  }, [inventoryId]);

  const requestCheck = useCallback(async (): Promise<AvailabilityCheckResult | null> => {
    if (!inventoryId || lock.current || pending) return null;
    lock.current = true;
    setSending(true);
    try {
      await apiClient.post(
        `/inventory-items/${encodeURIComponent(inventoryId)}/availability-check`
      );
      setPending(true);
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, message: errorMessage(error) };
    } finally {
      lock.current = false;
      setSending(false);
    }
  }, [apiClient, inventoryId, pending]);

  return { sending, pending, requestCheck };
}
