import { resolveCatalogHealth, tipIdsCoveredByCatalogHealth } from './catalogHealth';
import type { DashboardAggregates } from '../types/business/dashboard';

const aggregates = (
  overrides: Partial<DashboardAggregates> = {}
): DashboardAggregates => ({
  ordersTotal: 0,
  ordersByStatus: {},
  pendingCashReconciliationCount: 0,
  itemCount: 2,
  rentalItemCount: 0,
  locationCount: 1,
  inventoryCount: 2,
  pendingFailedDeliveriesCount: 0,
  uniqueClientCount: 0,
  totalProductViews: 0,
  productViewsLast7d: 0,
  topViewedProducts: [],
  approvedItemCount: 2,
  approvedRentalCount: 0,
  hasLogo: true,
  hasOperatingHours: true,
  lastCatalogItemAt: null,
  itemsNeedingAiCleanupCount: 0,
  pendingItemCount: 0,
  rejectedItemCount: 0,
  topViewedOutOfStockCount: 0,
  tipsRemindersEnabled: true,
  ...overrides,
});

describe('catalogHealth', () => {
  it('uses first_item when nothing is approved', () => {
    const state = resolveCatalogHealth(
      aggregates({ approvedItemCount: 0, itemCount: 0 }),
      'sell_items'
    );
    expect(state.primary).toBe('first_item');
    expect(state.approved).toBe(0);
  });

  it('uses add_product when under catalog target', () => {
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 4 }), 'sell_items')
        .primary
    ).toBe('add_product');
  });

  it('prioritizes rejected over progress', () => {
    expect(
      resolveCatalogHealth(
        aggregates({ approvedItemCount: 3, rejectedItemCount: 1 }),
        'sell_items'
      ).primary
    ).toBe('fix_rejected');
  });

  it('prioritizes restock when no rejects', () => {
    expect(
      resolveCatalogHealth(
        aggregates({ approvedItemCount: 12, topViewedOutOfStockCount: 2 }),
        'sell_items'
      ).primary
    ).toBe('restock');
  });

  it('uses manage when catalog is healthy', () => {
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 12 }), 'sell_items')
        .primary
    ).toBe('manage');
  });

  it('covers tip ids matching the primary CTA', () => {
    expect([...tipIdsCoveredByCatalogHealth('add_product')]).toEqual(
      expect.arrayContaining([
        'catalog_goal',
        'catalog_variety',
        'views_10_congrats',
      ])
    );
    expect([...tipIdsCoveredByCatalogHealth('fix_rejected')]).toContain(
      'rejected_item'
    );
    expect([...tipIdsCoveredByCatalogHealth('restock')]).toContain(
      'restock_top_viewed'
    );
  });
});
