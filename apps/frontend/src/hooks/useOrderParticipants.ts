import { useCallback, useEffect, useState } from 'react';
import type { MentionableParticipant } from './useOrderMessages';
import { useApiClient } from './useApiClient';

interface MentionableParticipantsResponse {
  success: boolean;
  participants: MentionableParticipant[];
  error?: string;
}

export interface UseOrderParticipantsReturn {
  participants: MentionableParticipant[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useOrderParticipants = (
  orderId: string | null | undefined
): UseOrderParticipantsReturn => {
  const apiClient = useApiClient();
  const [participants, setParticipants] = useState<MentionableParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!apiClient || !orderId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<MentionableParticipantsResponse>(
        `/orders/${orderId}/mentionable-participants`
      );
      if (response.data.success) {
        setParticipants(response.data.participants ?? []);
      } else {
        setError(response.data.error ?? 'Failed to load participants');
      }
    } catch (err: any) {
      setError(err.response?.data?.error ?? err.message ?? 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [apiClient, orderId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { participants, loading, error, refetch: fetch };
};
