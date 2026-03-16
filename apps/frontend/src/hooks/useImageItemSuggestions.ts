import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ImageItemSuggestions {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
}

export const useImageItemSuggestions = (
  imageId: string | null,
  enabled: boolean
) => {
  const apiClient = useApiClient();
  const [suggestions, setSuggestions] = useState<ImageItemSuggestions | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !imageId) {
      return;
    }
    let cancelled = false;
    const fetchSuggestions = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: ImageItemSuggestions;
          error?: string;
        }>('/ai/image-item-suggestions', { imageId });
        if (!cancelled) {
          if (response.data.success && response.data.data) {
            setSuggestions(response.data.data);
          } else {
            setError(
              response.data.error ||
                'Failed to get image item suggestions'
            );
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.error ||
              err.message ||
              'Failed to get image item suggestions'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    fetchSuggestions();
    return () => {
      cancelled = true;
    };
  }, [apiClient, imageId, enabled]);

  return { suggestions, loading, error };
};

