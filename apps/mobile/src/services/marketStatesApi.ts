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
  totalItemCount: number;
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
  const states: MarketState[] = rawStates.map((row) => ({
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
      ? (res?.totalRentalCount ?? res?.totalItemCount ?? 0)
      : (res?.totalItemCount ?? 0);
  return { states, totalItemCount };
}
