import { publicApiGet } from './publicApiClient';
import type { MarketState } from '../types/market';

export type MarketStatesCatalog = 'inventory' | 'rentals' | 'all';

interface MarketStatesResponse {
  success: boolean;
  states: Array<{
    state: string;
    itemCount?: number;
    rentalCount?: number;
    inventoryCount?: number;
  }>;
  totalItemCount: number;
  totalRentalCount?: number;
}

export interface MarketStatesResult {
  states: MarketState[];
  /** Total for the requested catalog (for `all`: the shop/inventory total). */
  totalItemCount: number;
  /** Shop (inventory) total. Present for `inventory` and `all`. */
  totalInventoryCount?: number;
  /** Rentals total. Present for `rentals` and `all`. */
  totalRentalCount?: number;
}

export async function fetchMarketStates(
  countryCode: string,
  catalog: MarketStatesCatalog = 'inventory'
): Promise<MarketStatesResult> {
  const params = new URLSearchParams({
    countryCode,
    catalog,
  });
  const res = await publicApiGet<MarketStatesResponse>(
    `/locations/market-states?${params.toString()}`
  );
  const rawStates = res?.states ?? [];
  const states: MarketState[] = rawStates.map((row) => {
    const inventoryCount = row.inventoryCount ?? row.itemCount ?? 0;
    const rentalCount = row.rentalCount ?? (catalog === 'rentals' ? row.itemCount ?? 0 : 0);
    return {
      state: row.state,
      // `all` keeps both numbers separate; itemCount is the shop figure there.
      itemCount: catalog === 'rentals' ? rentalCount : inventoryCount,
      ...(catalog === 'all' ? { inventoryCount, rentalCount } : {}),
    };
  });
  const totalRentalCount = res?.totalRentalCount ?? (catalog === 'rentals' ? res?.totalItemCount : undefined);
  const totalItemCount =
    catalog === 'rentals' ? (totalRentalCount ?? 0) : (res?.totalItemCount ?? 0);
  return {
    states,
    totalItemCount,
    ...(catalog !== 'rentals' ? { totalInventoryCount: res?.totalItemCount ?? 0 } : {}),
    ...(catalog !== 'inventory' ? { totalRentalCount: totalRentalCount ?? 0 } : {}),
  };
}

/**
 * Exports INTO a market: `GET /inventory-items?export_only=true&country_code=XX&limit=1` → `total`.
 * Items shipped from origin-country sellers (not local sellers); no dedicated endpoint.
 * Rejects on any failure so callers can hide the count instead of showing a wrong 0.
 */
export async function fetchExportsIntoMarketCount(
  countryCode: string,
  init?: { signal?: AbortSignal }
): Promise<number> {
  const res = await publicApiGet<{ data?: { total?: number } }>(
    '/inventory-items',
    { export_only: 'true', country_code: countryCode, limit: 1 },
    init
  );
  const total = res?.data?.total;
  if (typeof total !== 'number' || !Number.isFinite(total)) {
    throw new Error('Exports count unavailable');
  }
  return total;
}
