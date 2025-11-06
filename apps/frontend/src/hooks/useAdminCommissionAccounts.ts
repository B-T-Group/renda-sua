import { AxiosInstance } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface CommissionUserAccount {
  id: string;
  currency: string;
  available_balance: number;
  withheld_balance: number;
  total_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionUser {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  user_type_id: string;
  created_at: string;
  updated_at: string;
  accounts: CommissionUserAccount[];
}

export const useAdminCommissionAccounts = () => {
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'admin.loading.default',
  });
  const [users, setUsers] = useState<CommissionUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureClient = useCallback(
    (client: AxiosInstance | null): AxiosInstance => {
      if (!client) throw new Error('admin.errors.noApiClient');
      return client;
    },
    []
  );

  const fetchCommissionUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = ensureClient(apiClient);
      const { data } = await callWithLoading(
        () => client.get('/admin/commission-users'),
        'admin.loading.fetchCommissionUsers'
      );
      const usersList = data.users || [];
      setUsers(usersList);
    } catch (err: any) {
      setError(err?.message || 'admin.errors.fetchCommissionUsers');
    } finally {
      setLoading(false);
    }
  }, [apiClient, callWithLoading, ensureClient]);

  useEffect(() => {
    fetchCommissionUsers();
  }, [fetchCommissionUsers]);

  // Separate company account (hq@rendasua.com) from partners
  const companyAccount = useMemo(() => {
    return users.find((user) => user.email === 'hq@rendasua.com') || null;
  }, [users]);

  const partnerAccounts = useMemo(() => {
    return users.filter((user) => user.user_type_id === 'partner');
  }, [users]);

  return useMemo(
    () => ({
      users,
      companyAccount,
      partnerAccounts,
      loading,
      error,
      fetchCommissionUsers,
    }),
    [users, companyAccount, partnerAccounts, loading, error, fetchCommissionUsers]
  );
};

