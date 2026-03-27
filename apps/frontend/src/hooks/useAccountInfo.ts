import { useCallback, useEffect, useState } from 'react';
import { useAccountSubscription } from './useAccountSubscription';
import { useApiClient } from './useApiClient';

export interface Account {
  id: string;
  user_id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  business_location_id?: string | null;
  business_location?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  account_transactions: Array<{
    id: string;
    account_id: string;
    transaction_type: string;
    amount: number;
    memo: string;
    created_at: string;
  }>;
}

export interface ClientInfo {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export const useAccountInfo = () => {
  const apiClient = useApiClient();
  const [data, setData] = useState<{
    accounts: Account[];
    clients: ClientInfo[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccountInfo = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: { accounts: Account[]; clients: ClientInfo[] };
      }>('/accounts/info');
      if (response.data.success && response.data.data) {
        setData(response.data.data);
      } else {
        setData(null);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ?? err?.message ?? 'Failed to load account info'
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchAccountInfo();
  }, [fetchAccountInfo]);

  const accounts: Account[] = data?.accounts ?? [];
  const clientInfo: ClientInfo[] = data?.clients ?? [];

  return {
    accounts,
    clientInfo,
    loading,
    error,
    refetch: fetchAccountInfo,
  };
};

export const useAccountById = (accountId: string) => {
  const apiClient = useApiClient();
  const [localAccount, setLocalAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  const fetchAccount = useCallback(async () => {
    if (!apiClient || !accountId) {
      setLocalAccount(null);
      return;
    }
    setLoading(true);
    setQueryError(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: { account: Account };
      }>(`/accounts/${accountId}`);
      if (res.data.success && res.data.data?.account) {
        setLocalAccount(res.data.data.account);
      } else {
        setLocalAccount(null);
      }
    } catch (err: any) {
      setQueryError(
        err?.response?.data?.error ??
          err?.message ??
          'Failed to load account'
      );
      setLocalAccount(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, accountId]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  const {
    loading: subscriptionLoading,
    error: subscriptionError,
    subscriptionFailed,
  } = useAccountSubscription({
    accountId,
    onAccountUpdate: (updatedAccount) => {
      setLocalAccount(updatedAccount);
    },
    enabled: !!accountId,
  });

  const account: Account | null = localAccount;

  return {
    account,
    loading: loading || subscriptionLoading,
    error: queryError || subscriptionError,
    subscriptionFailed,
    refetch: fetchAccount,
  };
};
