import {
  CATALOG_TARGET,
  approvedForInterest,
} from './businessStoreReadiness';
import type { DashboardAggregates } from '../types/business/dashboard';

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

/** Tip IDs whose CTA is already covered by the catalog-health primary button. */
export function tipIdsCoveredByCatalogHealth(
  primary: CatalogHealthPrimary
): Set<string> {
  const covered = new Set<string>();
  if (primary === 'fix_rejected') covered.add('rejected_item');
  if (primary === 'restock') covered.add('restock_top_viewed');
  if (primary === 'first_item' || primary === 'add_product') {
    covered.add('catalog_goal');
    covered.add('catalog_variety');
    covered.add('views_10_congrats');
  }
  return covered;
}
