import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RentalItemSearchRow {
  id: string;
  name: string;
}

export const useRentalItemSearch = () => {
  const apiClient = useApiClient();
  const [results, setResults] = useState<RentalItemSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { items: RentalItemSearchRow[] };
        }>('/rental-item-images/rental-items/search', {
          params: { q },
        });
        if (response.data.success) {
          setResults(response.data.data.items ?? []);
        } else {
          setResults([]);
        }
      } catch (err: any) {
        setError(err.message || 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { results, loading, error, search };
};
