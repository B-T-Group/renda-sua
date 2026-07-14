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
  const [userRolesByUserId, setUserRolesByUserId] = useState<
    Record<string, string[]>
  >({});
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

  const loadUsersWithRoles = useCallback(async () => {
    if (!apiClient) return;
    try {
      const { data } = await apiClient.get('/admin/rbac/users');
      const next: Record<string, string[]> = {};
      for (const row of data.users ?? []) {
        if (row?.userId) next[row.userId] = row.roles ?? [];
      }
      setUserRolesByUserId(next);
    } catch {
      // Role badge is best-effort; manage-businesses still works without it
    }
  }, [apiClient]);

  useEffect(() => {
    void loadRoles();
    void loadUsersWithRoles();
  }, [loadRoles, loadUsersWithRoles]);

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
      const nextRoles = data.roles ?? [];
      setUserRolesByUserId((prev) => ({ ...prev, [userId]: nextRoles }));
      return nextRoles;
    },
    [apiClient]
  );

  const isSuperuserUser = useCallback(
    (userId: string) =>
      (userRolesByUserId[userId] ?? []).includes('superuser'),
    [userRolesByUserId]
  );

  return {
    roles,
    loading,
    error,
    loadRoles,
    loadUsersWithRoles,
    getUserRoles,
    setUserRoles,
    isSuperuserUser,
  };
}
