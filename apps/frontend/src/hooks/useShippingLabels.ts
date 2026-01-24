import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export function useShippingLabels() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const printLabel = useCallback(
    async (orderId: string): Promise<void> => {
      if (!apiClient) {
        setError('API client not available');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.get<Blob>(
          `/pdf/shipping-labels/${orderId}`,
          { responseType: 'blob' }
        );
        const url = URL.createObjectURL(data);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
          w.addEventListener('load', () => {
            try {
              w.print();
            } catch {
              /* print not available */
            }
          });
        }
        // Revoke after a delay so the new tab can load the blob
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

  const printLabels = useCallback(
    async (orderIds: string[]): Promise<void> => {
      if (!apiClient || !orderIds.length) {
        setError(orderIds.length ? 'API client not available' : null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.post<Blob>(
          '/pdf/shipping-labels/batch',
          { orderIds },
          { responseType: 'blob' }
        );
        const url = URL.createObjectURL(data);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (w) {
          w.addEventListener('load', () => {
            try {
              w.print();
            } catch {
              /* print not available */
            }
          });
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
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
                : 'Failed to generate shipping labels';
        setError(message);
        throw new Error(message);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { printLabel, printLabels, loading, error };
}
