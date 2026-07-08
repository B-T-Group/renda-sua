import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export const STRIPE_TAX_CODE_GENERAL_TANGIBLE = 'txcd_99999999';

export interface StripeTaxCodeOption {
  id: string;
  name: string;
  description?: string | null;
  groupName?: string | null;
}

interface StripeTaxCodesResponse {
  codes: StripeTaxCodeOption[];
  total: number;
  limit: number;
  offset: number;
}

export function useStripeTaxCodes() {
  const apiClient = useApiClient();
  const [codes, setCodes] = useState<StripeTaxCodeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (searchTerm?: string) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm?.trim()) params.set('search', searchTerm.trim());
        params.set('limit', '200');
        const response = await apiClient.get<StripeTaxCodesResponse>(
          `/stripe-tax/codes?${params.toString()}`
        );
        setCodes(response.data?.codes ?? []);
      } catch (e: unknown) {
        setError(
          e instanceof Error ? e.message : 'Failed to load tax categories'
        );
        setCodes([]);
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  useEffect(() => {
    void search();
  }, [search]);

  return { codes, loading, error, search, refetch: search };
}
