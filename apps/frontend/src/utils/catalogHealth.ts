import type { DashboardAggregates } from '../hooks/useDashboardAggregates';

export const CATALOG_TARGET = 10;

export type CatalogHealthPrimary =
  | 'first_item'
  | 'add_product'
  | 'fix_rejected'
  | 'restock'
  | 'manage';

export type CatalogHealthState = {
  approved: number;
  target: number;
  pendingCount: number;
  rejectedCount: number;
  outOfStockViewedCount: number;
  primary: CatalogHealthPrimary;
  isRental: boolean;
};

export function approvedForInterest(
  aggregates: DashboardAggregates | null | undefined,
  mainInterest: string
): number {
  if (!aggregates) return 0;
  if (mainInterest === 'rent_items') {
    if (typeof aggregates.approvedRentalCount === 'number') {
      return aggregates.approvedRentalCount;
    }
    return aggregates.rentalItemCount ?? 0;
  }
  if (typeof aggregates.approvedItemCount === 'number') {
    return aggregates.approvedItemCount;
  }
  return aggregates.itemCount ?? 0;
}

export function resolveCatalogHealth(
  aggregates: DashboardAggregates | null | undefined,
  mainInterest: string
): CatalogHealthState {
  const isRental = mainInterest === 'rent_items';
  const approved = approvedForInterest(aggregates, mainInterest);
  const pendingCount = aggregates?.pendingItemCount ?? 0;
  const rejectedCount = aggregates?.rejectedItemCount ?? 0;
  const outOfStockViewedCount = aggregates?.topViewedOutOfStockCount ?? 0;

  let primary: CatalogHealthPrimary;
  if (rejectedCount > 0) {
    primary = 'fix_rejected';
  } else if (outOfStockViewedCount > 0) {
    primary = 'restock';
  } else if (approved === 0) {
    primary = 'first_item';
  } else if (approved < CATALOG_TARGET) {
    primary = 'add_product';
  } else {
    primary = 'manage';
  }

  return {
    approved,
    target: CATALOG_TARGET,
    pendingCount,
    rejectedCount,
    outOfStockViewedCount,
    primary,
    isRental,
  };
}
