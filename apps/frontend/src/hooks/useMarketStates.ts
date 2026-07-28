import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export type MarketStatesCatalog = 'inventory' | 'rentals' | 'all';

export interface MarketStatesResult {
  states: Array<{ state: string; itemCount: number }>;
  totalItemCount: number;
}

const cache = new Map<string, MarketStatesResult>();

export function useMarketStates(
  countryCode: string | null | undefined,
  enabled = true,
  catalog: MarketStatesCatalog = 'inventory'
) {
  const api = useApiClient();
  const [result, setResult] = useState<MarketStatesResult>({
    states: [],
    totalItemCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = countryCode ? `${countryCode}:${catalog}` : '';

  useEffect(() => {
    if (!countryCode || !enabled) return;
    const cached = cache.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{
        success: boolean;
        states: Array<{
          state: string;
          itemCount?: number;
          inventoryCount?: number;
          rentalCount?: number;
        }>;
        totalItemCount: number;
        totalRentalCount?: number;
      }>('/locations/market-states', {
        params: { countryCode, catalog },
      })
      .then((res) => {
        if (!active) return;
        const raw = res.data.states ?? [];
        const states = raw.map((row) => ({
          state: row.state,
          itemCount:
            catalog === 'rentals'
              ? (row.itemCount ?? 0)
              : catalog === 'all'
                ? (row.inventoryCount ?? 0) + (row.rentalCount ?? 0)
                : (row.itemCount ?? row.inventoryCount ?? 0),
        }));
        const totalItemCount =
          catalog === 'rentals'
            ? (res.data.totalRentalCount ?? res.data.totalItemCount ?? 0)
            : (res.data.totalItemCount ?? 0);
        const next = { states, totalItemCount };
        cache.set(cacheKey, next);
        setResult(next);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Failed to load states');
        setResult({ states: [], totalItemCount: 0 });
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, cacheKey, catalog, countryCode, enabled]);

  const refetch = useCallback(() => {
    if (cacheKey) cache.delete(cacheKey);
  }, [cacheKey]);

  return { ...result, loading, error, refetch };
}
