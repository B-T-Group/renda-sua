import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchExportSellers } from '../services/inventoryItemsApi';
import type { ExportSeller } from '../types/stores';
import type { ExportSellersContext } from '../utils/exportSellers';

export interface UseExportSellersOptions extends ExportSellersContext {
  search?: string;
  /** Page size (carousel 10, list 30). */
  limit: number;
  enabled?: boolean;
  businessLocationId?: string;
}

/** Exports sellers in the Into / From context, with total for the More card and paging. */
export function useExportSellers({
  direction,
  marketCode,
  originCode,
  search,
  limit,
  enabled = true,
  businessLocationId,
}: UseExportSellersOptions) {
  const [sellers, setSellers] = useState<ExportSeller[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const offsetRef = useRef(0);
  const hasContext = direction === 'from' ? Boolean(originCode) : Boolean(marketCode);
  const query = { direction, marketCode, originCode, search, limit, businessLocationId };
  const key = JSON.stringify(query);

  useEffect(() => {
    if (!enabled || !hasContext) {
      setSellers([]);
      setTotal(0);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    offsetRef.current = 0;
    fetchExportSellers(query, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return;
        setSellers(page.stores);
        setTotal(page.total);
        offsetRef.current = page.stores.length;
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, hasContext, nonce]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || offsetRef.current >= total) return;
    setLoadingMore(true);
    try {
      const page = await fetchExportSellers({ ...JSON.parse(key), offset: offsetRef.current });
      offsetRef.current += page.stores.length;
      setSellers((prev) => [...prev, ...page.stores]);
      setTotal(page.total);
    } catch {
      // keep what we have; the list footer stays as is
    } finally {
      setLoadingMore(false);
    }
  }, [key, loading, loadingMore, total]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { sellers, total, loading, loadingMore, error, loadMore, refetch };
}
