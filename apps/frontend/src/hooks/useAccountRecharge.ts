import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RechargeTransaction {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  description: string;
  provider: string;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  customer_phone?: string;
  transaction_id?: string;
  error_message?: string;
  payment_entity?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountTopUpRecord {
  id: string;
  amount: number;
  memo: string;
  created_at: string;
  reference_id: string | null;
}

export interface InitiateRechargeParams {
  countryCode: string;
  phoneNumber: string;
  amount: number;
}

export function useAccountRecharge() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentTransactions, setRecentTransactions] = useState<AccountTopUpRecord[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const initiateRecharge = useCallback(
    async (params: InitiateRechargeParams) => {
      if (!apiClient) throw new Error('No API client');
      setLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.post('/admin/account-recharge/initiate', params);
        return data.data as { transactionId: string; providerTransactionId?: string; provider?: string; message?: string };
      } catch (e: any) {
        const msg =
          e?.response?.data?.message || e?.message || 'Failed to initiate recharge';
        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const getRechargeStatus = useCallback(
    async (transactionId: string): Promise<RechargeTransaction> => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.get(`/admin/account-recharge/transactions/${transactionId}/status`);
      return data.data as RechargeTransaction;
    },
    [apiClient]
  );

  const loadRecentTransactions = useCallback(async () => {
    if (!apiClient) return;
    setTransactionsLoading(true);
    try {
      const { data } = await apiClient.get('/admin/account-recharge/recent');
      setRecentTransactions(data.data?.items ?? []);
    } catch {
      // best-effort
    } finally {
      setTransactionsLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadRecentTransactions();
  }, [loadRecentTransactions]);

  return {
    loading,
    error,
    recentTransactions,
    transactionsLoading,
    initiateRecharge,
    getRechargeStatus,
    loadRecentTransactions,
  };
}
