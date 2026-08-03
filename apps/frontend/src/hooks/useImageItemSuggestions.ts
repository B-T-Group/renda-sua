import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type SuggestionFieldConfidence = 'high' | 'medium' | 'low';

export interface ImageItemSuggestionConfidence {
  name: SuggestionFieldConfidence;
  categoryName: SuggestionFieldConfidence;
  subCategoryName: SuggestionFieldConfidence;
  brandName: SuggestionFieldConfidence;
  description: SuggestionFieldConfidence;
  price: SuggestionFieldConfidence;
}

export interface DuplicateCandidate {
  itemId: string;
  name: string;
  similarity: number;
}

export interface ListingQualityScore {
  score: number;
  label: 'poor' | 'fair' | 'good' | 'great';
  suggestedAction: string | null;
}

export interface ImageItemSuggestions {
  name?: string;
  categoryName?: string;
  subCategoryName?: string;
  brandName?: string;
  descriptionSuggestion?: string;
  price?: number;
  currency?: string;
  isUsed?: boolean;
  confidence?: ImageItemSuggestionConfidence;
  categoryAlternates?: string[];
  subCategoryAlternates?: string[];
  duplicateCandidates?: DuplicateCandidate[];
  listingQuality?: ListingQualityScore;
}

export type UseImageItemSuggestionsOptions = {
  /** When true, fetch while the condition holds (e.g. dialog open). */
  autoWhen?: boolean;
  /** Increment (e.g. on button click) to run a fetch; 0 means wait for first click. */
  trigger?: number;
  /** Optional merchant hint describing the product. */
  hint?: string;
};

export const useImageItemSuggestions = (
  imageIds: string[] | null | undefined,
  options: UseImageItemSuggestionsOptions = {}
) => {
  const { autoWhen = false, trigger = 0, hint } = options;
  const apiClient = useApiClient();
  const [suggestions, setSuggestions] = useState<ImageItemSuggestions | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = imageIds?.filter(Boolean).join(',') ?? '';
  const hintKey = hint?.trim() ?? '';

  const refetch = useCallback(
    async (overrideHint?: string) => {
      if (!imageIds?.length) return null;
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: ImageItemSuggestions;
          error?: string;
        }>('/ai/image-item-suggestions', {
          imageIds: (imageIds ?? []).filter(Boolean),
          ...(overrideHint?.trim() || hintKey
            ? { hint: (overrideHint ?? hintKey).trim() }
            : {}),
        });
        if (response.data.success && response.data.data) {
          setSuggestions(response.data.data);
          return response.data.data;
        }
        setError(
          response.data.error || 'Failed to get image item suggestions'
        );
        return null;
      } catch (err: any) {
        setError(
          err.response?.data?.error ||
            err.message ||
            'Failed to get image item suggestions'
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, hintKey, imageIds]
  );

  useEffect(() => {
    if (!imageIds?.length) {
      return;
    }
    if (!autoWhen && trigger < 1) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{
          success: boolean;
          data?: ImageItemSuggestions;
          error?: string;
        }>('/ai/image-item-suggestions', {
          imageIds: (imageIds ?? []).filter(Boolean),
          ...(hintKey ? { hint: hintKey } : {}),
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
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient, idsKey, autoWhen, trigger, hintKey]);

  return { suggestions, loading, error, refetch };
};
