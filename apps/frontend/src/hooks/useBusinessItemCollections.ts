import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';
import { businessItemsApiParams } from '../utils/businessItemsApiParams';

export interface BusinessCollectionOption {
  id: string;
  slug: string;
  name_en: string;
  name_fr: string;
  description_en: string | null;
  description_fr: string | null;
  image_url: string | null;
  is_featured: boolean;
  sort_order: number;
  assigned: boolean;
}

export interface CollectionSuggestion {
  collectionId: string;
  slug: string;
  name_en: string;
  name_fr: string;
  source: 'ai';
  reason?: string;
}

export function useBusinessItemCollections(
  itemId: string | null,
  open: boolean,
  businessId?: string
) {
  const apiClient = useApiClient();
  const [collections, setCollections] = useState<BusinessCollectionOption[]>([]);
  const [suggestions, setSuggestions] = useState<CollectionSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!itemId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const catalogParams = businessItemsApiParams(businessId).params ?? {};
      const [listRes, suggestRes] = await Promise.all([
        apiClient.get<{
          success: boolean;
          data: { collections: BusinessCollectionOption[] };
        }>('/business-items/collections', {
          params: { itemId, ...catalogParams },
        }),
        apiClient.get<{
          success: boolean;
          data: { suggestions: CollectionSuggestion[] };
        }>(
          `/business-items/items/${itemId}/collection-suggestions`,
          businessItemsApiParams(businessId)
        ),
      ]);
      if (listRes.data.success) {
        setCollections(listRes.data.data.collections ?? []);
      }
      if (suggestRes.data.success) {
        setSuggestions(suggestRes.data.data.suggestions ?? []);
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to load collections';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiClient, itemId, open, businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveCollections = useCallback(
    async (collectionIds: string[]) => {
      if (!itemId) return false;
      setSaving(true);
      setError(null);
      try {
        await apiClient.put(
          `/business-items/items/${itemId}/collections`,
          { collectionIds },
          businessItemsApiParams(businessId)
        );
        await load();
        return true;
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Failed to save collections';
        setError(message);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [apiClient, itemId, businessId, load]
  );

  return {
    collections,
    suggestions,
    loading,
    saving,
    error,
    saveCollections,
    refetch: load,
  };
}
