import { useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface RentalFromImageSuggestionData {
  name?: string;
  description?: string;
  rental_category_id: string | null;
  rentalCategorySuggestion?: string;
  suggested_tags: string[];
  currency: string;
}

export type UseRentalFromImageSuggestionsOptions = {
  /** When true, fetch while the condition holds (e.g. dialog open + AI prefill). */
  autoWhen?: boolean;
  /** Increment (e.g. on button click) to run a fetch; 0 waits for first click. */
  trigger?: number;
};

export const useRentalFromImageSuggestions = (
  imageId: string | null,
  options: UseRentalFromImageSuggestionsOptions = {}
) => {
  const { autoWhen = false, trigger = 0 } = options;
  const apiClient = useApiClient();
  const [suggestions, setSuggestions] =
    useState<RentalFromImageSuggestionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!imageId) {
      setSuggestions(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!autoWhen && trigger < 1) {
      setSuggestions(null);
      setError(null);
      return;
    }
    setSuggestions(null);
    let cancelled = false;
    const run = async () => {
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
        if (!cancelled) {
          if (response.data.success && response.data.data) {
            setSuggestions(response.data.data);
          } else {
            setError(
              response.data.error || 'Failed to analyze image'
            );
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(
            err.response?.data?.error ||
              err.message ||
              'Failed to analyze image'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [apiClient, imageId, autoWhen, trigger]);

  return { suggestions, loading, error };
};
