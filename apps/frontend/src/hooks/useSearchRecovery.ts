import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';
import type { InventoryItem } from './useInventoryItems';

export interface RecoveryFilterRemoval {
  filter: 'category' | 'subcategory' | 'brand' | 'min_price' | 'max_price' | 'location_name' | 'business_name' | 'currency';
  value: string;
  count: number;
}

export interface RecoveryCategory {
  id: number | null;
  name: string;
}

export type RecoveryRung = 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

export interface SearchRecoveryData {
  enabled: boolean;
  query: string;
  corrected_query: string | null;
  corrected_total: number;
  relax: RecoveryFilterRemoval[];
  similar: InventoryItem[];
  categories: RecoveryCategory[];
  popular_near_you: InventoryItem[];
  ask_renda: { enabled: boolean; query: string };
  first_rung: RecoveryRung | null;
}

interface RecoveryParams {
  search?: string;
  category?: string;
  subcategory?: string;
  brand?: string;
  location_name?: string;
  business_name?: string;
  min_price?: number;
  max_price?: number;
  currency?: string;
  country_code?: string;
  state?: string;
  collection?: string;
  food_only?: boolean;
}

export function useSearchRecovery() {
  const apiClient = useApiClient();
  const [recovery, setRecovery] = useState<SearchRecoveryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRecovery = useCallback(
    async (params: RecoveryParams): Promise<SearchRecoveryData | null> => {
      if (!apiClient) return null;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<{
          success: boolean;
          data: SearchRecoveryData;
          message: string;
        }>('/inventory-items/search/recovery', { params });

        if (response.data.success) {
          setRecovery(response.data.data);
          return response.data.data;
        }
        setError(response.data.message || 'Failed to fetch recovery suggestions');
        setRecovery(null);
        return null;
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (err as { message?: string })?.message ||
          'Failed to fetch recovery suggestions';
        setError(errorMessage);
        setRecovery(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const reset = useCallback(() => {
    setRecovery(null);
    setError(null);
  }, []);

  return {
    recovery,
    loading,
    error,
    fetchRecovery,
    reset,
  };
}
