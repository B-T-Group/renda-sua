import { useEffect, useState } from 'react';
import { marketExportsCountUrl } from '../utils/marketCountsRequests';
import type { MarketState } from '../types/market';
import { useApiClient } from './useApiClient';

export interface MarketLaneCounts {
  rentals: number;
  exports: number;
  shop: number;
}

export interface MarketPickerState extends MarketState {
  inventoryCount: number;
  rentalCount: number;
}

export interface MarketPickerCounts {
  /** Per-lane totals for the opened country, or null while loading / when a call failed. */
  counts: MarketLaneCounts | null;
  /** Shop and rentals totals when the states call worked (feeds the "All of X" row even if exports failed). */
  totals: { rentals: number; shop: number } | null;
  /** Sub-regions with separate shop and rentals counts (market-states catalog=all). */
  states: MarketPickerState[];
  /** True until both calls for the opened country settle. */
  loading: boolean;
  /** True when the states call failed (rows then behave as today: no counts). */
  statesFailed: boolean;
}

type Settled = {
  country: string;
  at: number;
  states: MarketPickerState[] | null;
  rentals: number | null;
  shop: number | null;
  exports: number | null;
};

/** Short-lived cache so reopening the dialog does not refetch; lane switches never refetch. */
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, Settled>();

interface MarketStatesResponse {
  states?: Array<{ state: string; inventoryCount?: number; rentalCount?: number }>;
  totalItemCount?: number;
  totalRentalCount?: number;
}

/**
 * One load per opened country: market-states `catalog=all` (shop + rentals, never summed)
 * and one exports-into-market total. Calls settle independently: if either count call
 * fails the strip is hidden but state rows keep the states call's numbers. Results for a
 * different country are never shown while a new one loads.
 */
export function useMarketPickerCounts(
  countryCode: string | null | undefined,
  enabled: boolean
): MarketPickerCounts {
  const api = useApiClient();
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!countryCode || !enabled) return;
    const cached = cache.get(countryCode);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setSettled(cached);
      return;
    }
    let active = true;
    setSettled(null);
    Promise.allSettled([
      api.get<MarketStatesResponse>('/locations/market-states', {
        params: { countryCode, catalog: 'all' },
      }),
      api.get<{ data?: { total?: number } }>(marketExportsCountUrl(countryCode)),
    ]).then(([statesRes, exportsRes]) => {
      if (!active) return;
      const body = statesRes.status === 'fulfilled' ? statesRes.value.data : null;
      const total =
        exportsRes.status === 'fulfilled' ? exportsRes.value.data?.data?.total : undefined;
      const next: Settled = {
        country: countryCode,
        at: Date.now(),
        states: body
          ? (body.states ?? []).map((row) => ({
              state: row.state,
              inventoryCount: row.inventoryCount ?? 0,
              rentalCount: row.rentalCount ?? 0,
              itemCount: row.inventoryCount ?? 0,
            }))
          : null,
        shop: body ? (body.totalItemCount ?? 0) : null,
        rentals: body ? (body.totalRentalCount ?? 0) : null,
        exports: typeof total === 'number' && Number.isFinite(total) ? total : null,
      };
      // Only cache complete answers so a transient failure is retried on the next open.
      if (next.states && next.exports !== null) cache.set(countryCode, next);
      setSettled(next);
    });
    return () => {
      active = false;
    };
  }, [api, countryCode, enabled]);

  const current = settled && settled.country === countryCode ? settled : null;
  if (!current) {
    return { counts: null, totals: null, states: [], loading: !!countryCode && enabled, statesFailed: false };
  }
  const { rentals, shop, exports } = current;
  const counts =
    rentals !== null && shop !== null && exports !== null ? { rentals, shop, exports } : null;
  return {
    counts,
    totals: rentals !== null && shop !== null ? { rentals, shop } : null,
    states: current.states ?? [],
    loading: false,
    statesFailed: current.states === null,
  };
}

/** Test helper: drop cached answers. */
export function clearMarketPickerCountsCache(): void {
  cache.clear();
}
