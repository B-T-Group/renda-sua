import type { InventoryItem } from '../inventory-items/inventory-items.service';
import {
  rankBySignals,
  type CatalogRankSignals,
} from './catalog-ranking.weights';

const FRESH_WINDOW_DAYS = 30;
const LOCAL_DISTANCE_METERS = 50_000;
const MS_PER_DAY = 86_400_000;

export function listingRankSignals(
  item: InventoryItem,
  personalization = 0
): CatalogRankSignals {
  return {
    popularity: item.viewsCount ?? 0,
    promotion: item.hasActiveDeal || item.promotion ? 1 : 0,
    inventory: item.computed_available_quantity > 0 ? 1 : 0,
    local: localSignal(item.distance_value),
    freshness: freshnessSignal(item.created_at),
    personalization,
  };
}

export function rankListings(
  items: InventoryItem[],
  limit: number,
  personalization: Map<string, number> = new Map()
): InventoryItem[] {
  return rankBySignals(
    items,
    (item) => listingRankSignals(item, personalization.get(item.item_id) ?? 0),
    limit
  );
}

function localSignal(distance?: number): number {
  if (distance == null || !Number.isFinite(distance)) return 0;
  return Math.max(0, 1 - distance / LOCAL_DISTANCE_METERS);
}

function freshnessSignal(createdAt?: string): number {
  const created = createdAt ? Date.parse(createdAt) : NaN;
  if (!Number.isFinite(created)) return 0;
  const ageDays = (Date.now() - created) / MS_PER_DAY;
  return Math.max(0, 1 - ageDays / FRESH_WINDOW_DAYS);
}
