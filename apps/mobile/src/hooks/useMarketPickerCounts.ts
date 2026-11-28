import { useEffect, useState } from 'react';
import {
  fetchExportsIntoMarketCount,
  fetchMarketStates,
} from '../services/marketStatesApi';
import type { MarketState } from '../types/market';

export interface MarketLaneCounts {
  rentals: number;
  exports: number;
  shop: number;
}

export interface MarketPickerCounts {
  /** Per-lane totals for the opened country, or null while loading / when a call failed. */
  counts: MarketLaneCounts | null;
  /** Shop and rentals totals when the states call worked (feeds the "All of X" row even if exports failed). */
  totals: { rentals: number; shop: number } | null;
  /** Sub-regions with separate shop and rentals counts (from market-states catalog=all). */
  states: MarketState[];
  /** True until both calls for the opened country settle. */
  loading: boolean;
  /** True when the states call failed (rows then behave as today: no counts). */
  statesFailed: boolean;
}

type Settled = {
  country: string;
  states: MarketState[] | null;
  rentals: number | null;
  shop: number | null;
  exports: number | null;
};

/**
 * Loads everything the opened market needs in one go: market-states `catalog=all`
 * (shop + rentals, never summed) and one exports-into-market total. The two calls
 * settle independently: if either count call fails the strip is hidden, but state
 * rows still show whatever the states call returned. Results for another country
 * are never shown while a new one loads.
 */
export function useMarketPickerCounts(
  countryCode: string | null | undefined,
  enabled: boolean
): MarketPickerCounts {
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!countryCode || !enabled) return;
    let active = true;
    setSettled(null);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    Promise.allSettled([
      fetchMarketStates(countryCode, 'all'),
      fetchExportsIntoMarketCount(countryCode, { signal: controller?.signal }),
    ]).then(([statesRes, exportsRes]) => {
      if (!active) return;
      const states = statesRes.status === 'fulfilled' ? statesRes.value : null;
      setSettled({
        country: countryCode,
        states: states?.states ?? null,
        rentals: states?.totalRentalCount ?? null,
        shop: states?.totalInventoryCount ?? null,
        exports: exportsRes.status === 'fulfilled' ? exportsRes.value : null,
      });
    });
    return () => {
      active = false;
      controller?.abort();
    };
  }, [countryCode, enabled]);

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
