import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CountryAdminGrant {
  role: string;
  countryCode: string | null;
  stateKey: string | null;
  stateName: string | null;
}

export interface CountryAdminUser {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  grants: CountryAdminGrant[];
}

export interface ScopedMarket {
  countryCode: string;
  countryName: string;
  states: Array<{ id: string; name: string }>;
}

export interface ScopedRoleGrant {
  role: 'country_admin';
  countryCode: string;
  stateIds?: string[];
}

export function useCountryAdmins() {
  const apiClient = useApiClient();
  const [users, setUsers] = useState<CountryAdminUser[]>([]);
  const [markets, setMarkets] = useState<ScopedMarket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const [admins, catalog] = await Promise.all([
        apiClient.get('/admin/rbac/country-admins'),
        apiClient.get('/admin/rbac/markets'),
      ]);
      setUsers(admins.data.users ?? []);
      setMarkets(catalog.data.markets ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const lookup = useCallback(
    async (email: string) => {
      const { data } = await apiClient.get('/admin/rbac/users/lookup', { params: { email } });
      return data.user as { userId: string; email: string; firstName: string | null; lastName: string | null };
    },
    [apiClient]
  );

  const save = useCallback(
    async (userId: string, grants: ScopedRoleGrant[]) => {
      await apiClient.put(`/admin/rbac/users/${userId}/scoped-roles`, { grants });
      await refresh();
    },
    [apiClient, refresh]
  );

  return { users, markets, loading, error, refresh, lookup, save };
}
