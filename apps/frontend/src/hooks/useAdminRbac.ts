import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface PlatformRole {
  id: string;
  key: string;
  name: string;
  description: string;
}

export function useAdminRbac() {
  const apiClient = useApiClient();
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get('/admin/rbac/roles');
      setRoles(data.roles ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  const getUserRoles = useCallback(
    async (userId: string): Promise<string[]> => {
      if (!apiClient) return [];
      const { data } = await apiClient.get(`/admin/rbac/users/${userId}/roles`);
      return data.roles ?? [];
    },
    [apiClient]
  );

  const setUserRoles = useCallback(
    async (userId: string, roleKeys: string[]): Promise<string[]> => {
      if (!apiClient) throw new Error('No API client');
      const { data } = await apiClient.put(
        `/admin/rbac/users/${userId}/roles`,
        { roles: roleKeys }
      );
      return data.roles ?? [];
    },
    [apiClient]
  );

  return { roles, loading, error, loadRoles, getUserRoles, setUserRoles };
}
