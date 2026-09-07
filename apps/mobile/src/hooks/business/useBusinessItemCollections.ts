import { useCallback, useEffect, useState } from 'react';
import { businessApi } from '../../services/businessApi';
import type { BusinessCollectionOption, CollectionSuggestion } from '../../types/business/collections';

export function useBusinessItemCollections(itemId: string | null, open: boolean) {
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
      const [listRes, suggestRes] = await Promise.all([
        businessApi.collections.list(itemId),
        businessApi.collections.suggestions(itemId),
      ]);
      if (listRes.success) setCollections(listRes.data?.collections ?? []);
      if (suggestRes.success) setSuggestions(suggestRes.data?.suggestions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [itemId, open]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveCollections = useCallback(
    async (collectionIds: string[]) => {
      if (!itemId) return false;
      setSaving(true);
      setError(null);
      try {
        await businessApi.collections.setForItem(itemId, collectionIds);
        await load();
        return true;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to save collections');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [itemId, load]
  );

  return { collections, suggestions, loading, saving, error, saveCollections, refetch: load };
}
