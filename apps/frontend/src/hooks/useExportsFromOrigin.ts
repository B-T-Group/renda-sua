import { useEffect, useState } from 'react';
import type { InventoryItem } from './useInventoryItems';
import { useApiClient } from './useApiClient';

const PAGE_SIZE = 50;
const MAX_PAGES = 6;

/**
 * Every live export item whose home listing is in `originCode` (up to 300), for the
 * public /exports/{cc} page. Uses GET /inventory-items?export_only=true&origin_country=CC.
 */
export function useExportsFromOrigin(originCode: string | null): {
  items: InventoryItem[];
  total: number;
  loading: boolean;
  error: boolean;
} {
  const api = useApiClient();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(originCode));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!originCode) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      const all: InventoryItem[] = [];
      let reported = 0;
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const res = await api.get('/inventory-items', {
          params: {
            export_only: true,
            origin_country: originCode,
            is_active: true,
            page,
            limit: PAGE_SIZE,
          },
        });
        const data = res.data?.data;
        const batch: InventoryItem[] = data?.items ?? [];
        reported = data?.total ?? all.length + batch.length;
        all.push(...batch);
        if (batch.length < PAGE_SIZE || all.length >= reported) break;
      }
      if (!cancelled) {
        setItems(all.filter((row) => Boolean(row?.item)));
        setTotal(reported);
      }
    })()
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, originCode]);

  return { items, total, loading, error };
}
