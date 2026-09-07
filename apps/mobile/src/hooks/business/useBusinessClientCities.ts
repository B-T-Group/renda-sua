import { useCallback, useEffect, useState } from 'react';
import { businessApi } from '../../services/businessApi';

export interface ClientCityFrequency {
  name: string;
  count: number;
}

export function useBusinessClientCities(enabled = true) {
  const [cities, setCities] = useState<ClientCityFrequency[]>([]);
  const [totalClientsWithCity, setTotalClientsWithCity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await businessApi.dashboard.getClientCities();
      if (!res?.success || !res.data) {
        throw new Error('Failed to load client cities');
      }
      setCities(res.data.cities ?? []);
      setTotalClientsWithCity(res.data.totalClientsWithCity ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setCities([]);
      setTotalClientsWithCity(0);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);

  return { cities, totalClientsWithCity, loading, error, refetch };
}
