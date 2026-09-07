import {
  approvedForInterest,
  buildReadinessSteps,
  resolveMerchantTip,
  readinessPercent,
} from './businessStoreReadiness';
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
  hasLogo: false,
  hasOperatingHours: false,
  lastCatalogItemAt: null,
  itemsNeedingAiCleanupCount: 0,
  pendingItemCount: 0,
  rejectedItemCount: 0,
  topViewedOutOfStockCount: 0,
  tipsRemindersEnabled: true,
  ...overrides,
});

describe('businessStoreReadiness', () => {
  it('computes percent with mm phone on mobile money', () => {
    const steps = buildReadinessSteps({
      aggregates: aggregates({ hasLogo: true, hasOperatingHours: true, approvedItemCount: 10 }),
      verification: {
        is_verified: true,
        accountFullName: 'A',
        nextAction: 'none',
        paymentRail: 'mobile_money',
        steps: {
          agreement: { complete: true },
          mobilePaymentPhone: { complete: false },
        },
      },
      mainInterest: 'sell_items',
      aiTokens: 0,
      tipsRemindersEnabled: true,
      isNudgeEligible: () => true,
    });
    expect(steps).toHaveLength(4);
    expect(readinessPercent(steps)).toBe(75);
  });

  it('resolves catalog goal tip before logo', () => {
    const tip = resolveMerchantTip({
      aggregates: aggregates({ approvedItemCount: 3 }),
      verification: null,
      mainInterest: 'sell_items',
      aiTokens: 5,
      tipsRemindersEnabled: true,
      isNudgeEligible: () => true,
    });
    expect(tip?.id).toBe('catalog_goal');
    expect(tip?.remainingToCatalog).toBe(7);
  });

  it('resolves first order celebration first', () => {
    const tip = resolveMerchantTip({
      aggregates: aggregates({ ordersTotal: 1, approvedItemCount: 12, hasLogo: true }),
      verification: null,
      mainInterest: 'sell_items',
      aiTokens: 0,
      tipsRemindersEnabled: true,
      isNudgeEligible: () => true,
    });
    expect(tip?.id).toBe('first_order_congrats');
  });

  it('hides tips when preference off', () => {
    expect(
      resolveMerchantTip({
        aggregates: aggregates({ approvedItemCount: 1 }),
        verification: null,
        mainInterest: 'sell_items',
        aiTokens: 5,
        tipsRemindersEnabled: false,
        isNudgeEligible: () => true,
      })
    ).toBeNull();
  });

  it('approvedForInterest uses rentals', () => {
    expect(
      approvedForInterest(aggregates({ approvedRentalCount: 4 }), 'rent_items')
    ).toBe(4);
  });

  it('catalog step exposes progress toward 10', () => {
    const steps = buildReadinessSteps({
      aggregates: aggregates({ approvedItemCount: 7 }),
      verification: null,
      mainInterest: 'sell_items',
      aiTokens: 0,
      tipsRemindersEnabled: true,
      isNudgeEligible: () => true,
    });
    const catalog = steps.find((s) => s.id === 'catalog_10');
    expect(catalog).toMatchObject({
      done: false,
      current: 7,
      target: 10,
    });
  });

  it('falls back to itemCount when approvedItemCount is omitted', () => {
    const { approvedItemCount: _drop, ...rest } = aggregates({ itemCount: 12 });
    expect(approvedForInterest(rest, 'sell_items')).toBe(12);
  });
});
