import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';
import {
  exportSellersQueryParams,
  parseExportSellersPage,
  type ExportSeller,
  type ExportSellersContext,
} from '../utils/exportSellers';

export interface UseExportSellersOptions extends ExportSellersContext {
  limit: number;
  search?: string;
  businessLocationId?: string;
  enabled?: boolean;
}

/** Exports sellers in the Into / From context (public endpoint), with total and paging. */
export function useExportSellers(opts: UseExportSellersOptions) {
  const api = useApiClient();
  const { direction, marketCode, originCode, limit, search, businessLocationId, enabled = true } = opts;
  const [sellers, setSellers] = useState<ExportSeller[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const offsetRef = useRef(0);
  const ctx: ExportSellersContext = { direction, marketCode, originCode };
  const hasContext = direction === 'from' ? Boolean(originCode) : Boolean(marketCode);
  const key = JSON.stringify([direction, marketCode, originCode, limit, search, businessLocationId]);

  useEffect(() => {
    if (!enabled || !hasContext) {
      setSellers([]);
      setTotal(0);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    api
      .get('/inventory-items/stores', {
        params: exportSellersQueryParams(ctx, { limit, search, businessLocationId }),
      })
      .then((res) => {
        if (cancelled) return;
        const page = parseExportSellersPage<ExportSeller>(res.data, ctx);
        setSellers(page.stores);
        setTotal(page.total);
        offsetRef.current = page.stores.length;
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, enabled, hasContext]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || offsetRef.current >= total) return;
    setLoadingMore(true);
    try {
      const res = await api.get('/inventory-items/stores', {
        params: exportSellersQueryParams(ctx, { limit, search, businessLocationId, offset: offsetRef.current }),
      });
      const page = parseExportSellersPage<ExportSeller>(res.data, ctx);
      offsetRef.current += page.stores.length;
      setSellers((prev) => [...prev, ...page.stores]);
    } catch {
      // keep the rows we have
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, key, loading, loadingMore, total]);

  return { sellers, total, loading, loadingMore, error, loadMore, hasMore: sellers.length < total };
}
