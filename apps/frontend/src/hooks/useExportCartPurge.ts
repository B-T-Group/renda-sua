import { useEffect, useRef, useState } from 'react';
import { useCart } from '../contexts/CartContext';
import { useApiClient } from './useApiClient';

const MAX_LOOKUPS = 30;

/**
 * Export-only items can't be bought in any market. The cart is client-side, so a line
 * added before that rule may still be there: on cart open, look each listing up and drop
 * export lines. Returns how many lines were removed (0 when none) for a one-time note.
 * Checkout preflight / createOrder still block EXPORT_AVAILABLE_ITEM as a backstop.
 */
export function useExportCartPurge(): { removedCount: number; dismiss: () => void } {
  const { cartItems, replaceItems } = useCart();
  const api = useApiClient();
  const [removedCount, setRemovedCount] = useState(0);
  const checked = useRef(new Set<string>());

  useEffect(() => {
    const ids = [...new Set(cartItems.map((line) => line.inventoryItemId))].filter(
      (id) => !checked.current.has(id)
    );
    if (ids.length === 0) return undefined;
    let cancelled = false;
    const batch = ids.slice(0, MAX_LOOKUPS);
    batch.forEach((id) => checked.current.add(id));
    void Promise.all(
      batch.map(async (id) => {
        try {
          const res = await api.get(`/inventory-items/${id}`);
          return res.data?.data?.item?.export_available === true ? id : null;
        } catch {
          return null;
        }
      })
    ).then((hits) => {
      if (cancelled) return;
      const exportIds = new Set(hits.filter((id): id is string => Boolean(id)));
      if (exportIds.size === 0) return;
      const keep = cartItems.filter((line) => !exportIds.has(line.inventoryItemId));
      const removed = cartItems.length - keep.length;
      if (removed > 0) {
        replaceItems(keep);
        setRemovedCount((n) => n + removed);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [api, cartItems, replaceItems]);

  return { removedCount, dismiss: () => setRemovedCount(0) };
}
