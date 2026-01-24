import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export function useShippingLabels() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printLabel = useCallback(
    async (orderId: string): Promise<Blob | null> => {
      if (!apiClient) {
        setError('API client not available');
        return null;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get<Blob>(
          `/pdf/shipping-labels/${orderId}`,
          { responseType: 'blob' }
        );
        return data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: unknown } }).response?.data
            : null;
        const message =
          typeof msg === 'string'
            ? msg
            : msg && typeof msg === 'object' && 'message' in msg
              ? String((msg as { message: unknown }).message)
              : err instanceof Error
                ? err.message
                : 'Failed to generate shipping label';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { printLabel, loading, error };
}
