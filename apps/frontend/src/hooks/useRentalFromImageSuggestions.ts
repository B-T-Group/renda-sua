import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RentalFromImageSuggestionData {
  name?: string;
  description?: string;
  rental_category_id: string | null;
  rentalCategorySuggestion?: string;
  suggested_tags: string[];
  currency: string;
}

export const useRentalFromImageSuggestions = () => {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(
    async (
      imageId: string
    ): Promise<RentalFromImageSuggestionData | null> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: RentalFromImageSuggestionData;
          error?: string;
        }>('/rental-item-images/rental-from-image-suggestions', {
          imageId,
        });
        if (!response.data.success || !response.data.data) {
          setError(response.data.error || 'Failed to analyze image');
          return null;
        }
        return response.data.data;
      } catch (err: any) {
        const msg =
          err.response?.data?.error ||
          err.message ||
          'Failed to analyze image';
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { fetchSuggestions, loading, error };
};
