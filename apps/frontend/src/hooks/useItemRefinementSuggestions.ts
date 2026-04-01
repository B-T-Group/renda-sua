import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ItemRefinementSuggestionData {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
  sku?: string;
  model?: string;
  color?: string;
  suggestedTagsEn?: string[];
  suggestedTagsFr?: string[];
  barcodeValues?: string[];
  weight?: number;
  weightUnit?: string;
  dimensions?: string;
  isFragile?: boolean;
  isPerishable?: boolean;
  requiresSpecialHandling?: boolean;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
  price?: number;
  currency?: string;
}

export function useItemRefinementSuggestions() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(
    async (itemId: string): Promise<ItemRefinementSuggestionData | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.post<{
          success: boolean;
          data?: ItemRefinementSuggestionData;
          error?: string;
        }>(
          '/ai/item-refinement-suggestions',
          { itemId },
          { timeout: 120000 }
        );
        if (res.data.success && res.data.data) {
          return res.data.data;
        }
        const msg =
          (res.data as { error?: string }).error ||
          'Failed to get AI suggestions';
        setError(msg);
        return null;
      } catch (err: any) {
        const msg =
          err.response?.data?.error ||
          err.message ||
          'Failed to get AI suggestions';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { fetchSuggestions, loading, error };
}
