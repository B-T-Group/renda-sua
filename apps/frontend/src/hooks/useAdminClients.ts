import { AxiosInstance } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface AdminClientUser {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  accounts?: Array<{
    id: string;
    currency: string;
    available_balance: number;
    withheld_balance: number;
    total_balance: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

export interface AdminClient {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  user: AdminClientUser;
  addresses: Array<{
    id: string;
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    is_primary: boolean;
    address_type: string;
    latitude?: number;
    longitude?: number;
    created_at: string;
    updated_at: string;
  }>;
}

export interface UpdateClientPayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export const useAdminClients = () => {
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'admin.loading.default',
  });
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureClient = useCallback(
    (client: AxiosInstance | null): AxiosInstance => {
      if (!client) throw new Error('admin.errors.noApiClient');
      return client;
    },
    []
  );

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = ensureClient(apiClient);
      const { data } = await callWithLoading(
        () => client.get('/admin/clients'),
        'admin.loading.fetchClients'
      );
      setClients(data.clients || []);
    } catch (err: any) {
      setError(err?.message || 'admin.errors.fetchClients');
    } finally {
      setLoading(false);
    }
  }, [apiClient, callWithLoading, ensureClient]);

  const updateClient = useCallback(
    async (id: string, updates: UpdateClientPayload) => {
      const client = ensureClient(apiClient);
      await callWithLoading(
        () => client.patch(`/admin/clients/${id}`, updates),
        'admin.loading.updateClient'
      );
      await fetchClients();
    },
    [apiClient, callWithLoading, ensureClient, fetchClients]
  );

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  return useMemo(
    () => ({ clients, loading, error, fetchClients, updateClient }),
    [clients, loading, error, fetchClients, updateClient]
  );
};
