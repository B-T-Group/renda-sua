import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchAuthenticatedInventoryItemById,
  fetchPublicInventoryItemById,
} from '../services/inventoryItemsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

export function useInventoryItemDetail(
  inventoryItemId: string | undefined,
  options?: { withAuth?: boolean }
) {
  const withAuth = options?.withAuth ?? false;
  const [item, setItem] = useState<CatalogInventoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (id: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const fetchById = withAuth ? fetchAuthenticatedInventoryItemById : fetchPublicInventoryItemById;
      const res = await fetchById(id, { signal: controller.signal });
      if (!res.success) {
        setError(res.message || 'Failed');
        setItem(null);
        return;
      }
      setItem(res.data);
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed');
      setItem(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [withAuth]);

  useEffect(() => {
    if (!inventoryItemId?.trim()) {
      setItem(null);
      setLoading(false);
      setError('Missing item');
      return;
    }
    void load(inventoryItemId.trim());
    return () => {
      abortRef.current?.abort();
    };
  }, [inventoryItemId, load]);

  return { item, loading, error, refetch: () => inventoryItemId && void load(inventoryItemId.trim()) };
}
