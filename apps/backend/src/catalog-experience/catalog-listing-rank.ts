import type { InventoryItem } from '../inventory-items/inventory-items.service';
import { bayesianRating } from '../inventory-items/discovery/discovery-sort.util';
import {
  rankBySignals,
  type CatalogRankSignals,
} from './catalog-ranking.weights';

const FRESH_WINDOW_DAYS = 30;
const LOCAL_DISTANCE_METERS = 50_000;
const MS_PER_DAY = 86_400_000;

export function listingRankSignals(
  item: InventoryItem,
  personalization = 0,
  options: { ratingMean?: number } = {}
): CatalogRankSignals {
  return {
    // Only set when a caller opts in (discovery_sort_v1), so existing carousels rank identically.
    ...(options.ratingMean !== undefined && {
      rating: ratingSignal(item, options.ratingMean),
    }),
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

/** Bayesian rating scaled to 0..1; unrated items contribute nothing. */
export function ratingSignal(item: InventoryItem, mean: number): number {
  const b = bayesianRating(item.avg_rating, item.rating_count, mean);
  return b === null ? 0 : Math.max(0, Math.min(1, b / 5));
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
