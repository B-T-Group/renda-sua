export const CATALOG_RANKING_WEIGHTS = {
  search: 4,
  popularity: 1,
  conversion: 3,
  local: 2,
  inventory: 1,
  freshness: 1,
  promotion: 5,
  personalization: 6,
} as const;

export type CatalogRankingWeights = typeof CATALOG_RANKING_WEIGHTS;

export interface CatalogRankSignals {
  search?: number;
  popularity?: number;
  conversion?: number;
  local?: number;
  inventory?: number;
  freshness?: number;
  promotion?: number;
  personalization?: number;
}

export function scoreCatalogCandidate(
  signals: CatalogRankSignals,
  weights: CatalogRankingWeights = CATALOG_RANKING_WEIGHTS
): number {
  return (
    (signals.search ?? 0) * weights.search +
    (signals.popularity ?? 0) * weights.popularity +
    (signals.conversion ?? 0) * weights.conversion +
    (signals.local ?? 0) * weights.local +
    (signals.inventory ?? 0) * weights.inventory +
    (signals.freshness ?? 0) * weights.freshness +
    (signals.promotion ?? 0) * weights.promotion +
    (signals.personalization ?? 0) * weights.personalization
  );
}

export function rankBySignals<T>(
  items: T[],
  signalsFor: (item: T) => CatalogRankSignals,
  limit: number
): T[] {
  return items
    .map((item) => ({ item, score: scoreCatalogCandidate(signalsFor(item)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.item);
}
