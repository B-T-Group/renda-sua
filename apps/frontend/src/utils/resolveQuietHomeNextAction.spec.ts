import { resolveCatalogHealth } from './catalogHealth';
import {
  resolveQuietHomeGating,
  resolveQuietHomeNextAction,
} from './resolveQuietHomeNextAction';
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
  it('prioritizes catalog health: rejected, restock, first item, add, manage', () => {
    expect(
      resolveCatalogHealth(
        aggregates({ rejectedItemCount: 2, topViewedOutOfStockCount: 1 }),
        'sell_items'
      ).primary
    ).toBe('fix_rejected');
    expect(
      resolveCatalogHealth(
        aggregates({ topViewedOutOfStockCount: 1, approvedItemCount: 0 }),
        'sell_items'
      ).primary
    ).toBe('restock');
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 0 }), 'sell_items')
        .primary
    ).toBe('first_item');
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 4 }), 'sell_items')
        .primary
    ).toBe('add_product');
    expect(
      resolveCatalogHealth(aggregates({ approvedItemCount: 10 }), 'sell_items')
        .primary
    ).toBe('manage');
  });

  it('uses rental approved count and falls back when aggregates are missing', () => {
    expect(
      resolveCatalogHealth(
        aggregates({
          approvedRentalCount: 2,
          rentalItemCount: 8,
          approvedItemCount: 10,
        }),
        'rent_items'
      ).approved
    ).toBe(2);
    expect(
      resolveCatalogHealth(
        aggregates({
          approvedRentalCount: undefined,
          rentalItemCount: 3,
        }),
        'rent_items'
      ).approved
    ).toBe(3);
    expect(resolveCatalogHealth(null, 'sell_items')).toMatchObject({
      approved: 0,
      primary: 'first_item',
      isRental: false,
    });
  });

  it('keeps fulfillment modules while aggregates load or fail', () => {
    expect(
      resolveQuietHomeGating({
        showOperationalModules: true,
        aggregatesLoading: true,
        aggregates: null,
      })
    ).toEqual({ quietHomeMode: false, fulfillmentMode: true });
    expect(
      resolveQuietHomeGating({
        showOperationalModules: true,
        aggregatesLoading: false,
        aggregates: null,
        aggregatesError: 'Failed to load dashboard',
      })
    ).toEqual({ quietHomeMode: false, fulfillmentMode: true });
    expect(
      resolveQuietHomeGating({
        showOperationalModules: true,
        aggregatesLoading: false,
        aggregates: { ordersTotal: 0 },
      })
    ).toEqual({ quietHomeMode: true, fulfillmentMode: false });
    expect(
      resolveQuietHomeGating({
        showOperationalModules: true,
        aggregatesLoading: false,
        aggregates: { ordersTotal: 2 },
      })
    ).toEqual({ quietHomeMode: false, fulfillmentMode: true });
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

  it('offers sale items after primary catalog tips for rental merchants', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        approvedItemCount: 12,
        approvedRentalCount: 12,
        rentalItemCount: 12,
        itemCount: 0,
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
      mainInterest: 'rent_items',
      showIdReview: false,
      showMmPhoneConfirm: false,
    });
    expect(action?.id).toBe('offer_sale_items');
  });

  it('does not offer the other catalog before the first approved item', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        approvedItemCount: 0,
        itemCount: 0,
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
    expect(action?.id).not.toBe('offer_rentals');
  });

  it('does not offer sale items when a rental merchant already sells', () => {
    const action = resolveQuietHomeNextAction({
      aggregates: aggregates({
        approvedItemCount: 12,
        approvedRentalCount: 12,
        rentalItemCount: 12,
        itemCount: 2,
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
      mainInterest: 'rent_items',
      showIdReview: false,
      showMmPhoneConfirm: false,
    });
    expect(action).toBeNull();
  });
});
