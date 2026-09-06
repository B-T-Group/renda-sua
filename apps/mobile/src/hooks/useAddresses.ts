import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '../services/agentApi';
import type { UserAddress } from '../types/agent';

export function useAddresses() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await agentApi.addresses.getList();
      setAddresses(list);
      return list;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur chargement adresses');
      setAddresses([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  const deleteAddress = useCallback(async (id: string) => {
    await agentApi.addresses.delete(id);
    await fetchAddresses();
  }, [fetchAddresses]);

  return {
    addresses,
    loading,
    error,
    refetch: fetchAddresses,
    deleteAddress,
  };
}
