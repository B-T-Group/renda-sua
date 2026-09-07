import { useCallback, useEffect, useState } from 'react';
import {
  fetchMarketStates,
  type MarketStatesCatalog,
  type MarketStatesResult,
} from '../services/marketStatesApi';

const EMPTY: MarketStatesResult = { states: [], totalItemCount: 0 };

export interface UseMarketStatesResult {
  states: MarketStatesResult['states'];
  totalItemCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads states/regions with catalog counts for a given country.
 */
export function useMarketStates(
  countryCode: string | null | undefined,
  enabled = true,
  catalog: MarketStatesCatalog = 'inventory'
): UseMarketStatesResult {
  const [result, setResult] = useState<MarketStatesResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!countryCode || !enabled) return;
    let active = true;
    setLoading(true);
    setError(null);
    fetchMarketStates(countryCode, catalog)
      .then((res) => {
        if (!active) return;
        setResult(res);
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err?.message ?? 'Failed to load states');
        setResult(EMPTY);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [countryCode, enabled, catalog, tick]);

  return { states: result.states, totalItemCount: result.totalItemCount, loading, error, refetch };
}
