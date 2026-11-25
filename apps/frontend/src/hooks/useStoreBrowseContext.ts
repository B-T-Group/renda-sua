import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CollectionSummary } from './useCollections';
import type { InventoryItem } from './useInventoryItems';
import { useApiClient } from './useApiClient';

export interface StoreBrowseCategory {
  id: number;
  name: string;
  item_count: number;
}

export interface StorePopularGroup {
  category_name: string;
  items: InventoryItem[];
}

export interface StoreBrowseContext {
  business_location_id: string;
  categories: StoreBrowseCategory[];
  deals: InventoryItem[];
  popular: StorePopularGroup[];
  collections: CollectionSummary[];
}

export function useStoreBrowseContext(options: {
  businessId?: string;
  foodOnly?: boolean;
  ownerPreview?: boolean;
  enabled?: boolean;
}) {
  const { i18n } = useTranslation();
  const api = useApiClient();
  const [context, setContext] = useState<StoreBrowseContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = options.enabled !== false && Boolean(options.businessId?.trim());
  const lang = i18n.language?.startsWith('fr') ? 'fr' : 'en';

  const fetchContext = useCallback(async () => {
    if (!enabled || !options.businessId?.trim()) {
      setContext(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<{
        success: boolean;
        data: StoreBrowseContext;
        message?: string;
      }>(
        `/inventory-items/stores/${encodeURIComponent(options.businessId.trim())}/browse-context`,
        {
          params: {
            lang,
            ...(options.foodOnly && { food_only: true }),
            ...(options.ownerPreview && { owner_preview: true }),
          },
        }
      );
      if (!data.success) {
        setContext(null);
        setError(data.message || 'Failed to load store browse context');
        return;
      }
      setContext(data.data);
    } catch (e: unknown) {
      setContext(null);
      setError(
        e instanceof Error ? e.message : 'Failed to load store browse context'
      );
    } finally {
      setLoading(false);
    }
  }, [
    api,
    enabled,
    lang,
    options.businessId,
    options.foodOnly,
    options.ownerPreview,
  ]);

  useEffect(() => {
    void fetchContext();
  }, [fetchContext]);

  return { context, loading, error, refetch: fetchContext };
}
