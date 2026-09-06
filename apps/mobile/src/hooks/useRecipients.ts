import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { SavedRecipient } from '../types/recipient';

export interface UseRecipientsOptions {
  /** Filter recipients by country (ISO code). */
  country?: string;
  /** If false, do not fetch automatically on mount. */
  enabled?: boolean;
}

export interface UseRecipientsResult {
  recipients: SavedRecipient[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<SavedRecipient[]>;
}

/**
 * Hook to fetch and manage saved recipients for diaspora orders.
 * Scoped to fulfillment country when provided.
 */
export function useRecipients(options?: UseRecipientsOptions): UseRecipientsResult {
  const { country, enabled = true } = options ?? {};
  const [recipients, setRecipients] = useState<SavedRecipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async (): Promise<SavedRecipient[]> => {
    if (!enabled) return [];
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.recipients.getList(country ? { country } : undefined);
      if (res.success && Array.isArray(res.recipients)) {
        setRecipients(res.recipients);
        return res.recipients;
      }
      const errMsg = res.error || 'Failed to fetch recipients';
      setError(errMsg);
      setRecipients([]);
      return [];
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Failed to fetch recipients';
      setError(errMsg);
      setRecipients([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [country, enabled]);

  useEffect(() => {
    if (enabled) {
      void refetch();
    }
  }, [enabled, refetch]);

  return { recipients, loading, error, refetch };
}
