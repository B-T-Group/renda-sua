import { AxiosInstance } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useApiClient } from './useApiClient';
import { useApiWithLoading } from './useApiWithLoading';

export interface AdminAgentUser {
  id: string;
  identifier: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
}

export interface AdminAgent {
  id: string;
  user_id: string;
  vehicle_type_id: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  user: AdminAgentUser;
  addresses: any[];
}

export interface UpdateAgentPayload {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  is_verified?: boolean;
  vehicle_type_id?: string;
}

export const useAdminAgents = () => {
  const apiClient = useApiClient();
  const { callWithLoading } = useApiWithLoading({
    loadingMessage: 'admin.loading.default',
  });
  const [agents, setAgents] = useState<AdminAgent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureClient = useCallback(
    (client: AxiosInstance | null): AxiosInstance => {
      if (!client) throw new Error('admin.errors.noApiClient');
      return client;
    },
    []
  );

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = ensureClient(apiClient);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (search) params.set('search', search);
      const { data } = await callWithLoading(
        () => client.get(`/admin/agents?${params.toString()}`),
        'admin.loading.fetchAgents'
      );
      setAgents(data.items || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setError(err?.message || 'admin.errors.fetchAgents');
    } finally {
      setLoading(false);
    }
  }, [apiClient, callWithLoading, ensureClient, page, limit, search]);

  const updateAgent = useCallback(
    async (id: string, updates: UpdateAgentPayload) => {
      const client = ensureClient(apiClient);
      await callWithLoading(
        () => client.patch(`/admin/agents/${id}`, updates),
        'admin.loading.updateAgent'
      );
      await fetchAgents();
    },
    [apiClient, callWithLoading, ensureClient, fetchAgents]
  );

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  return useMemo(
    () => ({
      agents,
      total,
      page,
      limit,
      search,
      setPage,
      setLimit,
      setSearch,
      loading,
      error,
      fetchAgents,
      updateAgent,
    }),
    [
      agents,
      total,
      page,
      limit,
      search,
      loading,
      error,
      fetchAgents,
      updateAgent,
    ]
  );
};
