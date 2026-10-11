import { useEffect, useState } from 'react';
import { publicApiGet } from '../services/publicApiClient';
import type { CatalogInventoryItem } from '../types/inventoryCatalog';

/** 2-3 in-stock similar listings (GET /inventory-items/:id/similar) for the "Gone again" state. */
export function useSimilarInStockItems(inventoryItemId: string | undefined, active: boolean) {
  const [items, setItems] = useState<CatalogInventoryItem[]>([]);

  useEffect(() => {
    if (!active || !inventoryItemId) {
      setItems([]);
      return;
    }
    let cancelled = false;
    void publicApiGet<{ data?: CatalogInventoryItem[] }>(
      `/inventory-items/${encodeURIComponent(inventoryItemId)}/similar`,
      { limit: 12 }
    )
      .then((res) => {
        if (cancelled) return;
        const inStock = (res.data ?? []).filter(
          (i) => i.id !== inventoryItemId && (i.computed_available_quantity ?? 0) > 0
        );
        setItems(inStock.slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [inventoryItemId, active]);

  return items;
}
