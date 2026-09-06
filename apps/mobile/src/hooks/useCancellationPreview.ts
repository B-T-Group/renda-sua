import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { CancellationPreview } from '../types/agent';
import { trackCancellationEvent } from '../utils/cancellationAnalytics';

export interface UseCancellationPreviewResult {
  preview: CancellationPreview | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useCancellationPreview(
  orderId: string | null
): UseCancellationPreviewResult {
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await agentApi.orders.getCancellationPreview(orderId);
      setPreview(result);
      trackCancellationEvent('cancellation_preview_loaded', {
        orderId,
        canCancel: result.canCancel,
        refundType: result.refundType,
      });
    } catch (e: any) {
      const msg = e?.message ?? 'Failed to load cancellation preview';
      setError(msg);
      trackCancellationEvent('cancellation_preview_failed', { orderId, error: msg });
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { preview, loading, error, refetch: fetch };
}
