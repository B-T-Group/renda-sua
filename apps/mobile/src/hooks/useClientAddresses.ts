import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { UserAddress } from '../types/agent';

export function useClientAddresses() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<UserAddress[]> => {
    setLoading(true);
    setError(null);
    try {
      const list = await agentApi.addresses.getList({ 'X-Active-Persona': 'client' });
      setAddresses(list);
      return list;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load addresses');
      setAddresses([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { addresses, loading, error, refetch: load };
}
