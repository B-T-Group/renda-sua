import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface ImageItemSuggestions {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
  price?: number;
  currency?: string;
}

export type UseImageItemSuggestionsOptions = {
  /** When true, fetch while the condition holds (e.g. dialog open). */
  autoWhen?: boolean;
  /** Increment (e.g. on button click) to run a fetch; 0 means wait for first click. */
  trigger?: number;
};

export const useImageItemSuggestions = (
  imageIds: string[] | null | undefined,
  options: UseImageItemSuggestionsOptions = {}
) => {
  const { autoWhen = false, trigger = 0 } = options;
  const apiClient = useApiClient();
  const [suggestions, setSuggestions] = useState<ImageItemSuggestions | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = imageIds?.filter(Boolean).join(',') ?? '';

  useEffect(() => {
    if (!imageIds?.length) {
      return;
    }
    if (!autoWhen && trigger < 1) {
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
        }>('/ai/image-item-suggestions', {
          imageIds: (imageIds ?? []).filter(Boolean),
        });
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
  }, [apiClient, idsKey, autoWhen, trigger]);

  return { suggestions, loading, error };
};

