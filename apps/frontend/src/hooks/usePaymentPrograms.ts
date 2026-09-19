import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface PaymentProgramSummary {
  facilities: Array<{
    id: string;
    limit_amount: number;
    currency: string;
    status: string;
    ends_at: string | null;
    program?: { name: string };
    account?: { cash_advance_balance: number; available_balance: number };
    draws?: Array<{ id: string; amount: number; created_at: string }>;
  }>;
  grants: Array<{
    id: string;
    currency: string;
    amount: number;
    remaining_amount: number;
    applicability: string;
    expires_at: string | null;
    memo: string | null;
    business?: { name: string } | null;
    redemptions?: Array<{ id: string; amount: number; created_at: string }>;
  }>;
  assignments: Array<{
    id: string;
    amount: number;
    currency: string;
    starts_at: string;
    ends_at: string | null;
    status: string;
    schedule?: { name: string; frequency: string };
    runs?: Array<{
      id: string;
      period_start: string;
      amount: number;
      status: string;
      failure_reason: string | null;
    }>;
  }>;
}

export function usePaymentPrograms() {
  const apiClient = useApiClient();
  const [data, setData] = useState<PaymentProgramSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/payment-programs/me');
      setData(response.data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load payment programs');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const draw = useCallback(
    async (amount: number, currency: string) => {
      await apiClient.post('/payment-programs/cash-advance/draw', { amount, currency });
      await refresh();
    },
    [apiClient, refresh]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, draw };
}
