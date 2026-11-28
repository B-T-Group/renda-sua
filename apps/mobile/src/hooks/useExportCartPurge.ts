import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../stores/RootStore';
import { fetchPublicInventoryItemById } from '../services/inventoryItemsApi';

const MAX_LOOKUPS = 30;

/**
 * The cart is client-side, so export-only lines added before the rule can still be there.
 * On cart open, look each listing up and drop export-only ones; returns the count for a
 * one-time note. Preflight / createOrder still reject EXPORT_AVAILABLE_ITEM as a backstop.
 */
export function useExportCartPurge() {
  const { cart } = useStore();
  const [removedCount, setRemovedCount] = useState(0);
  const checked = useRef(new Set<string>());

  const ids = [...new Set(cart.items.map((l) => l.inventoryItemId))];
  const pending = ids.filter((id) => !checked.current.has(id)).slice(0, MAX_LOOKUPS);
  const pendingKey = pending.join(',');

  useEffect(() => {
    if (!pendingKey) return undefined;
    let stop = false;
    const lookups = pendingKey.split(',');
    for (const id of lookups) checked.current.add(id);
    void Promise.all(
      lookups.map(async (id) => {
        try {
          const res = await fetchPublicInventoryItemById(id);
          return res?.success && res.data?.item?.export_available === true ? id : null;
        } catch {
          return null;
        }
      })
    ).then((found) => {
      if (stop) return;
      const exportIds = found.filter((x): x is string => !!x);
      const removed = cart.removeListings(exportIds);
      if (removed > 0) setRemovedCount((n) => n + removed);
    });
    return () => {
      stop = true;
    };
  }, [pendingKey, cart]);

  const dismiss = useCallback(() => setRemovedCount(0), []);
  return { removedCount, dismiss };
}
