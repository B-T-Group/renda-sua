import { resolveCatalogHealth } from './catalogHealth';
import { resolveQuietHomeNextAction } from './resolveQuietHomeNextAction';
import type { DashboardAggregates } from '../hooks/useDashboardAggregates';

const aggregates = (
  overrides: Partial<DashboardAggregates> = {}
): DashboardAggregates => ({
  ordersTotal: 0,
  ordersByStatus: {},
  pendingCashReconciliationCount: 0,
  itemCount: 5,
  rentalItemCount: 0,
  locationCount: 1,
  inventoryCount: 5,
  pendingFailedDeliveriesCount: 0,
  uniqueClientCount: 0,
  totalProductViews: 0,
  productViewsLast7d: 0,
  topViewedProducts: [],
  approvedItemCount: 5,
  hasLogo: true,
  hasOperatingHours: true,
  pendingItemCount: 0,
  rejectedItemCount: 0,
  topViewedOutOfStockCount: 0,
  ...overrides,
});

describe('web quiet home utils', () => {
  it('resolves catalog health progress', () => {
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 4 }), 'sell_items')
        .primary
    ).toBe('add_product');
  });

  it('prioritizes cannot_accept_orders', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates(),
      verification: {
        is_verified: false,
        can_accept_orders: false,
        accountFullName: 'A',
        nextAction: 'upload_id',
        steps: { agreement: { complete: true } },
      },
      mainInterest: 'sell_items',
      showIdReview: true,
      showMmPhoneConfirm: true,
    });
    expect(action?.id).toBe('cannot_accept_orders');
  });

  it('skips catalog_goal when catalog health owns add CTA', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        approvedItemCount: 3,
        hasLogo: false,
      }),
      verification: {
        is_verified: true,
        can_accept_orders: true,
        accountFullName: 'A',
        nextAction: 'complete',
        steps: { agreement: { complete: true } },
      },
      mainInterest: 'sell_items',
      showIdReview: false,
      showMmPhoneConfirm: false,
    });
    expect(action?.id).toBe('logo');
  });

  it('hides growth tips when tipsRemindersEnabled is false', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        tipsRemindersEnabled: false,
        pendingItemCount: 2,
        hasLogo: false,
      }),
      verification: {
        is_verified: true,
        can_accept_orders: true,
        accountFullName: 'A',
        nextAction: 'complete',
        steps: { agreement: { complete: true } },
      },
      mainInterest: 'sell_items',
      showIdReview: false,
      showMmPhoneConfirm: false,
    });
    expect(action).toBeNull();
  });

  it('offers rentals after primary catalog tips for sale merchants', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        approvedItemCount: 12,
        rentalItemCount: 0,
        hasLogo: true,
        hasOperatingHours: true,
      }),
      verification: {
        is_verified: true,
        can_accept_orders: true,
        accountFullName: 'A',
        nextAction: 'complete',
        steps: { agreement: { complete: true } },
      },
      mainInterest: 'sell_items',
      showIdReview: false,
      showMmPhoneConfirm: false,
    });
    expect(action?.id).toBe('offer_rentals');
  });
});
