import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface PendingMobilePaymentRow {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  customer_phone?: string;
  transaction_id?: string;
  provider: string;
  created_at: string;
}

export interface ProviderStatusResponse {
  success: boolean;
  data: {
    providerStatus: {
      transactionId: string;
      status: string;
      amount: number;
      currency: string;
      reference: string;
      message?: string;
      provider?: string;
    };
    dbStatus: string;
    dbReference: string;
    provider: string;
  };
}

export function useAdminPendingMobilePayments() {
  const api = useApiClient();
  const [items, setItems] = useState<PendingMobilePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{
        success: boolean;
        data: { items: PendingMobilePaymentRow[]; limit: number; offset: number };
      }>('/admin/mobile-payments/pending', { params: { limit, offset } });
      setItems(res.data.data?.items ?? []);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (e as Error)?.message || 'Request failed';
      setError(msg);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [api, limit, offset]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  return {
    items,
    loading,
    error,
    refetch: fetchList,
    offset,
    setOffset,
    limit,
    hasMore: items.length >= limit,
  };
}

export function useAdminMobilePaymentProviderStatus() {
  const api = useApiClient();
  return useCallback(
    async (id: string) => {
      const res = await api.get<ProviderStatusResponse>(
        `/admin/mobile-payments/${id}/provider-status`
      );
      return res.data;
    },
    [api]
  );
}

export function useResolvePendingMobilePayment() {
  const api = useApiClient();
  return useCallback(
    async (id: string) => {
      const res = await api.post<{
        success: boolean;
        replayed?: boolean;
        message?: string;
        data?: unknown;
      }>(`/admin/mobile-payments/${id}/resolve`);
      return res.data;
    },
    [api]
  );
}
