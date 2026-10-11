/**
 * Discovery sort (#342). Pure helpers: no I/O, no clock reads (callers pass `nowMs`) so every rule
 * is unit-testable. Only used when the `discovery_sort_v1` flag is on for the viewer's market.
 */
import type { InventoryItem } from '../inventory-items.service';

export const DISCOVERY_SORT_FLAG_KEY = 'discovery_sort_v1';
export const DISCOVERY_NEW_SORTS = [
  'recommended',
  'popular',
  'rating',
  'newest',
] as const;
export type DiscoveryNewSort = (typeof DISCOVERY_NEW_SORTS)[number];
/** Sort values accepted from clients when the flag is on (relevance already exists). */
export type DiscoverySort = DiscoveryNewSort | 'relevance';

/** Bayesian prior weight (AC: m = 5 reviews). */
export const RATING_PRIOR_WEIGHT = 5;
/** AC-2.1: show the rating on cards only from this many reviews. */
export const RATING_DISPLAY_MIN_REVIEWS = 3;
/** AC-2.2: listed within this many days earns the "New" chip. */
export const NEW_ITEM_DAYS = 14;
/** AC-1.7: fewer results than this disables the control; fewer than 2 hides it. */
export const SORT_CONTROL_MIN_RESULTS = 4;
export const SORT_CONTROL_HIDE_BELOW = 2;
const MS_PER_DAY = 86_400_000;

export function isDiscoveryNewSort(value: unknown): value is DiscoveryNewSort {
  return (
    typeof value === 'string' &&
    (DISCOVERY_NEW_SORTS as readonly string[]).includes(value)
  );
}

export interface PopularityCounts {
  d30: number;
  d90: number;
}

export type PopularityMap = Map<string, PopularityCounts>;

export interface RatingStats {
  mean: number;
}

/** Market average rating weighted by review count (the Bayesian prior mean). */
export function marketMeanRating(items: InventoryItem[]): number {
  let sum = 0;
  let n = 0;
  for (const it of items) {
    const c = it.rating_count ?? 0;
    const avg = it.avg_rating ?? 0;
    if (c > 0 && Number.isFinite(avg)) {
      sum += avg * c;
      n += c;
    }
  }
  return n > 0 ? sum / n : 0;
}

/** (n * avg + m * mean) / (n + m); items with no reviews return null (rank below rated). */
export function bayesianRating(
  avg: number | null | undefined,
  count: number | null | undefined,
  mean: number,
  m: number = RATING_PRIOR_WEIGHT
): number | null {
  const n = count ?? 0;
  if (n <= 0 || avg == null || !Number.isFinite(avg)) return null;
  return (n * avg + m * mean) / (n + m);
}

export function inStock(item: InventoryItem): boolean {
  return (item.computed_available_quantity ?? 0) > 0;
}

function createdMs(item: InventoryItem, firstListed?: Map<string, number>) {
  const own = Date.parse(item.created_at);
  const first = firstListed?.get(item.item_id);
  const t = first ?? own;
  return Number.isFinite(t) ? t : 0;
}

/** Earliest listing time per catalog item (first listed date). */
export function firstListedByItem(items: InventoryItem[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const it of items) {
    const t = Date.parse(it.created_at);
    if (!Number.isFinite(t)) continue;
    const prev = out.get(it.item_id);
    if (prev === undefined || t < prev) out.set(it.item_id, t);
  }
  return out;
}

export interface SortContext {
  popularity?: PopularityMap;
  firstListed?: Map<string, number>;
  ratingMean?: number;
  /** For `recommended`: precomputed blend score per item_id. */
  blendScore?: Map<string, number>;
}

type Comparator = (a: InventoryItem, b: InventoryItem) => number;

function byItemId(a: InventoryItem, b: InventoryItem): number {
  // Total order => pagination never reshuffles (AC-1.5).
  if (a.item_id < b.item_id) return -1;
  if (a.item_id > b.item_id) return 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function chain(...cmps: Comparator[]): Comparator {
  return (a, b) => {
    for (const c of cmps) {
      const r = c(a, b);
      if (r !== 0) return r;
    }
    return 0;
  };
}

const stockFirst: Comparator = (a, b) =>
  Number(inStock(b)) - Number(inStock(a));

export function buildComparator(
  mode: DiscoveryNewSort,
  ctx: SortContext
): Comparator {
  const newest: Comparator = (a, b) =>
    createdMs(b, ctx.firstListed) - createdMs(a, ctx.firstListed);
  switch (mode) {
    case 'popular': {
      const pop = (it: InventoryItem) =>
        ctx.popularity?.get(it.item_id) ?? { d30: 0, d90: 0 };
      return chain(
        stockFirst,
        (a, b) => pop(b).d30 - pop(a).d30,
        (a, b) => pop(b).d90 - pop(a).d90,
        newest,
        byItemId
      );
    }
    case 'rating': {
      const mean = ctx.ratingMean ?? 0;
      const score = (it: InventoryItem) =>
        bayesianRating(it.avg_rating, it.rating_count, mean);
      return chain(
        stockFirst,
        (a, b) => {
          const sa = score(a);
          const sb = score(b);
          if (sa === null && sb === null) return 0;
          if (sa === null) return 1; // unrated below rated
          if (sb === null) return -1;
          return sb - sa;
        },
        (a, b) => (b.rating_count ?? 0) - (a.rating_count ?? 0),
        newest,
        byItemId
      );
    }
    case 'newest':
      return chain(stockFirst, newest, byItemId);
    case 'recommended':
    default: {
      const blend = (it: InventoryItem) => ctx.blendScore?.get(it.item_id) ?? 0;
      return chain(stockFirst, (a, b) => blend(b) - blend(a), newest, byItemId);
    }
  }
}

export function sortDiscovery(
  items: InventoryItem[],
  mode: DiscoveryNewSort,
  ctx: SortContext
): InventoryItem[] {
  return [...items].sort(buildComparator(mode, ctx));
}

/** Stable partition used for Best match: keep the relevance order, in stock first (AC-1.2). */
export function stockFirstStable(items: InventoryItem[]): InventoryItem[] {
  const a: InventoryItem[] = [];
  const b: InventoryItem[] = [];
  for (const it of items) (inStock(it) ? a : b).push(it);
  return [...a, ...b];
}

/**
 * Per catalog item, keep only in-stock listings when any exist (so a sold-out store row never
 * represents an item that someone nearby can actually buy).
 */
export function preferInStockListings(items: InventoryItem[]): InventoryItem[] {
  const anyInStock = new Set<string>();
  for (const it of items) if (inStock(it)) anyInStock.add(it.item_id);
  return items.filter((it) => !anyInStock.has(it.item_id) || inStock(it));
}

export interface ItemTrustSignals {
  rating_display: { rating: number; count: number } | null;
  is_new: boolean;
}

/** AC-2.1 / 2.2 / 2.4: never fabricate; nothing under 3 reviews. */
export function trustSignals(item: InventoryItem, nowMs: number): ItemTrustSignals {
  const count = item.rating_count ?? 0;
  const avg = item.avg_rating;
  const showRating =
    count >= RATING_DISPLAY_MIN_REVIEWS && avg != null && Number.isFinite(avg);
  const created = Date.parse(item.created_at);
  const isNew =
    Number.isFinite(created) && nowMs - created <= NEW_ITEM_DAYS * MS_PER_DAY;
  return {
    rating_display: showRating
      ? { rating: Math.round((avg as number) * 10) / 10, count }
      : null,
    // New chip replaces the rating (AC-2.2 "instead of").
    is_new: isNew && !showRating,
  };
}

export type SortControlState = 'enabled' | 'disabled' | 'hidden';

export function sortControlState(totalResults: number): SortControlState {
  if (totalResults < SORT_CONTROL_HIDE_BELOW) return 'hidden';
  if (totalResults < SORT_CONTROL_MIN_RESULTS) return 'disabled';
  return 'enabled';
}

/**
 * Effective sort when the flag is on. Search results default to Best match (relevance),
 * browse defaults to Recommended; Recommended is not offered on a search (falls back to relevance).
 */
export function resolveDiscoverySort(input: {
  requested?: string;
  hasSearch: boolean;
  legacySort?: string;
}): DiscoverySort | undefined {
  const { requested, hasSearch, legacySort } = input;
  if (requested === 'relevance') return 'relevance';
  if (isDiscoveryNewSort(requested)) {
    if (requested === 'recommended' && hasSearch) return 'relevance';
    return requested;
  }
  // An explicit legacy sort (fastest, cheapest, top_rated, deals) keeps its old behaviour.
  if (legacySort && legacySort !== 'relevance') return undefined;
  return hasSearch ? 'relevance' : 'recommended';
}
