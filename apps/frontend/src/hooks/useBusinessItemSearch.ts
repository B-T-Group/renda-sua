import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface BusinessItemSearchResult {
  id: string;
  name: string;
  sku: string | null;
}

export const useBusinessItemSearch = () => {
  const apiClient = useApiClient();
  const [results, setResults] = useState<BusinessItemSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<{
          success: boolean;
          data: { items: BusinessItemSearchResult[] };
        }>('/business-images/item-search', {
          params: { q: trimmed },
        });
        if (response.data.success) {
          setResults(response.data.data.items || []);
        } else {
          setError('Failed to search items');
        }
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to search items'
        );
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return {
    results,
    loading,
    error,
    search,
  };
};

