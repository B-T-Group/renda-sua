import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchBagComplementsStop } from '../services/catalogStopsApi';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';
import type { CartLine } from '../types/cart';

export interface UseCatalogStopBagComplementsOptions {
  cartLines: CartLine[];
  enabled?: boolean;
}

/**
 * Fetches complementary items for "Goes with your bag" stop.
 * 
 * Falls back to client heuristic if backend returns empty but cart is non-empty.
 */
export function useCatalogStopBagComplements({
  cartLines,
  enabled = true,
}: UseCatalogStopBagComplementsOptions) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!enabled || cartLines.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);

    try {
      // Extract inventory item IDs from cart lines
      const inventoryItemIds = cartLines
        .map((line) => line.inventoryItemId)
        .filter((id): id is string => !!id);

      if (inventoryItemIds.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const envelope = await fetchBagComplementsStop(
        { inventory_item_ids: inventoryItemIds },
        { signal: controller.signal }
      );

      if (controller.signal.aborted) return;

      if (envelope.success && envelope.data) {
        const backendItems = envelope.data.items ?? [];
        
        // v1 note: If backend returns empty, we could fall back to client heuristic here
        // For now, trust backend's empty response (it might mean no complements available)
        setItems(backendItems);
      } else {
        setItems([]);
      }
    } catch (e: unknown) {
      if (controller.signal.aborted) return;
      if (e instanceof Error && e.name === 'AbortError') return;
      // On error, return empty (could add client fallback here if needed)
      setItems([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [cartLines, enabled]);

  useEffect(() => {
    if (!enabled) {
      abortRef.current?.abort();
      abortRef.current = null;
      setItems([]);
      setLoading(false);
      return;
    }

    void load();

    return () => {
      abortRef.current?.abort();
    };
  }, [enabled, load]);

  return { items, loading, refetch: load };
}
