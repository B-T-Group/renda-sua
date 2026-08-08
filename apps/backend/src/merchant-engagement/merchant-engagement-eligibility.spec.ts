import {
  approvedForInterest,
  resolveEngagementPushId,
} from './merchant-engagement-eligibility';
import type { MerchantEngagementCandidate } from './merchant-engagement.types';

function base(
  overrides: Partial<MerchantEngagementCandidate> = {}
): MerchantEngagementCandidate {
  return {
    businessId: 'b1',
    userId: 'u1',
    email: 'a@b.com',
    preferredLanguage: 'en',
    businessName: 'Shop',
    mainInterest: 'sell_items',
    aiTokens: 5,
    tipsRemindersEnabled: true,
    canAcceptOrders: true,
    lifecycleStatus: 'active',
    hasExpoPush: true,
    approvedItemCount: 2,
    approvedRentalCount: 0,
    pendingItemCount: 0,
    rejectedItemCount: 0,
    hasLogo: true,
    hasOperatingHours: true,
    lastCatalogItemAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    itemsNeedingAiCleanupCount: 0,
    topViewedOutOfStockCount: 0,
    totalProductViews: 0,
    ordersTotal: 0,
    liveSince: new Date(Date.now() - 20 * 86400000).toISOString(),
    ...overrides,
  };
}

describe('merchant-engagement-eligibility', () => {
  const now = new Date();

  it('approvedForInterest uses rentals for rent_items', () => {
    expect(
      approvedForInterest(base({ mainInterest: 'rent_items', approvedRentalCount: 4 }))
    ).toBe(4);
  });

  it('resolves catalog stalled when under 10 and idle', () => {
    const id = resolveEngagementPushId(base(), now, new Map());
    expect(id).toBe('push_catalog_stalled');
  });

  it('resolves first order congrats once', () => {
    const id = resolveEngagementPushId(
      base({ ordersTotal: 1, approvedItemCount: 12 }),
      now,
      new Map()
    );
    expect(id).toBe('push_first_order_congrats');
  });

  it('skips when tips disabled', () => {
    expect(
      resolveEngagementPushId(base({ tipsRemindersEnabled: false }), now, new Map())
    ).toBeNull();
  });

  it('resolves buy tokens when cleanup needed and no tokens', () => {
    const id = resolveEngagementPushId(
      base({
        approvedItemCount: 12,
        itemsNeedingAiCleanupCount: 3,
        aiTokens: 0,
        totalProductViews: 3,
      }),
      now,
      new Map([
        ['push_catalog_10_congrats', now],
        ['push_share_store', now],
      ])
    );
    expect(id).toBe('push_buy_tokens');
  });
});
