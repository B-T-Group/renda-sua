import { AxiosInstance } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface AdminBusinessUser {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface AdminBusiness {
  id: string;
  user_id: string;
  name: string;
  is_admin: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  user: AdminBusinessUser;
  addresses: any[];
}

export interface UpdateBusinessPayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  name?: string;
  is_admin?: boolean;
}

export const useAdminBusinesses = () => {
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'admin.loading.default',
  });
  const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureClient = useCallback(
    (client: AxiosInstance | null): AxiosInstance => {
      if (!client) throw new Error('admin.errors.noApiClient');
      return client;
    },
    []
  );

  const fetchBusinesses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = ensureClient(apiClient);
      const { data } = await callWithLoading(
        () => client.get('/admin/businesses'),
        'admin.loading.fetchBusinesses'
      );
      setBusinesses(data.businesses || []);
    } catch (err: any) {
      setError(err?.message || 'admin.errors.fetchBusinesses');
    } finally {
      setLoading(false);
    }
  }, [apiClient, callWithLoading, ensureClient]);

  const updateBusiness = useCallback(
    async (id: string, updates: UpdateBusinessPayload) => {
      const client = ensureClient(apiClient);
      await callWithLoading(
        () => client.patch(`/admin/businesses/${id}`, updates),
        'admin.loading.updateBusiness'
      );
      await fetchBusinesses();
    },
    [apiClient, callWithLoading, ensureClient, fetchBusinesses]
  );

  useEffect(() => {
    fetchBusinesses();
  }, [fetchBusinesses]);

  return useMemo(
    () => ({ businesses, loading, error, fetchBusinesses, updateBusiness }),
    [businesses, loading, error, fetchBusinesses, updateBusiness]
  );
};
