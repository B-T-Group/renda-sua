import { AxiosInstance } from 'axios';
import { useCallback, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface AccountTransaction {
  id: string;
  account_id: string;
  amount: number;
  transaction_type: string;
  memo?: string;
  reference_id?: string;
  created_at: string;
  account: {
    id: string;
    currency: string;
    user_id: string;
  };
}

export interface TransactionPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export const useAdminAccountTransactions = () => {
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'admin.loading.default',
  });
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [pagination, setPagination] = useState<TransactionPagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureClient = useCallback(
    (client: AxiosInstance | null): AxiosInstance => {
      if (!client) throw new Error('admin.errors.noApiClient');
      return client;
    },
    []
  );

  const fetchTransactions = useCallback(
    async (accountId: string, page: number = 1, limit: number = 50) => {
      setLoading(true);
      setError(null);
      try {
        const client = ensureClient(apiClient);
        const params = new URLSearchParams({
          page: String(page),
          limit: String(limit),
        });
        const { data } = await callWithLoading(
          () =>
            client.get(`/admin/accounts/${accountId}/transactions?${params.toString()}`),
          'admin.loading.fetchTransactions'
        );
        setTransactions(data.transactions || []);
        setPagination(data.pagination || pagination);
      } catch (err: any) {
        setError(err?.message || 'admin.errors.fetchTransactions');
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, callWithLoading, ensureClient, pagination]
  );

  return useMemo(
    () => ({
      transactions,
      pagination,
      loading,
      error,
      fetchTransactions,
    }),
    [transactions, pagination, loading, error, fetchTransactions]
  );
};

