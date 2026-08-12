import { resolvePaymentSetupNudge } from './payment-setup-nudge.util';
import {
  isExponentialBackoffDue,
  isPaymentSetupNudgeDue,
} from './merchant-engagement-eligibility';
import type { MerchantEngagementCandidate } from './merchant-engagement.types';

describe('resolvePaymentSetupNudge', () => {
  it('nudges Stripe merchants with views when Connect is incomplete', () => {
    expect(
      resolvePaymentSetupNudge({
        isStripeRail: true,
        stripeVerified: false,
        locations: [{ id: 'l1', viewCount: 3, phoneVerified: false }],
      })
    ).toEqual({ needsPaymentSetupNudge: true, paymentSetupViewCount: 3 });
  });

  it('skips Stripe merchants once Connect is verified', () => {
    expect(
      resolvePaymentSetupNudge({
        isStripeRail: true,
        stripeVerified: true,
        locations: [{ id: 'l1', viewCount: 10, phoneVerified: false }],
      })
    ).toEqual({ needsPaymentSetupNudge: false, paymentSetupViewCount: 0 });
  });

  it('nudges MoMo only for viewed locations without a confirmed phone', () => {
    expect(
      resolvePaymentSetupNudge({
        isStripeRail: false,
        stripeVerified: false,
        locations: [
          { id: 'l1', viewCount: 5, phoneVerified: false },
          { id: 'l2', viewCount: 2, phoneVerified: true },
          { id: 'l3', viewCount: 0, phoneVerified: false },
        ],
      })
    ).toEqual({ needsPaymentSetupNudge: true, paymentSetupViewCount: 5 });
  });

  it('skips MoMo when every viewed location has a confirmed phone', () => {
    expect(
      resolvePaymentSetupNudge({
        isStripeRail: false,
        stripeVerified: false,
        locations: [{ id: 'l1', viewCount: 4, phoneVerified: true }],
      })
    ).toEqual({ needsPaymentSetupNudge: false, paymentSetupViewCount: 0 });
  });
});

describe('isExponentialBackoffDue', () => {
  const now = new Date('2026-08-11T12:00:00.000Z');

  it('is due immediately when never sent', () => {
    expect(isExponentialBackoffDue(undefined, 0, now)).toBe(true);
  });

  it('waits 1 day after the first send', () => {
    const last = new Date(now.getTime() - 0.5 * 86400000);
    expect(isExponentialBackoffDue(last, 1, now)).toBe(false);
    const ready = new Date(now.getTime() - 1.1 * 86400000);
    expect(isExponentialBackoffDue(ready, 1, now)).toBe(true);
  });

  it('doubles the wait after each send and caps at 30 days', () => {
    const after3 = new Date(now.getTime() - 3.9 * 86400000);
    expect(isExponentialBackoffDue(after3, 3, now)).toBe(false); // needs 4d
    const after4 = new Date(now.getTime() - 4.1 * 86400000);
    expect(isExponentialBackoffDue(after4, 3, now)).toBe(true);
    const after20 = new Date(now.getTime() - 20 * 86400000);
    expect(isExponentialBackoffDue(after20, 10, now)).toBe(false); // capped 30
    const after31 = new Date(now.getTime() - 31 * 86400000);
    expect(isExponentialBackoffDue(after31, 10, now)).toBe(true);
  });
});

describe('isPaymentSetupNudgeDue', () => {
  const now = new Date();
  const candidate = (
    overrides: Partial<MerchantEngagementCandidate> = {}
  ): MerchantEngagementCandidate => ({
    businessId: 'b1',
    userId: 'u1',
    email: 'a@b.com',
    preferredLanguage: 'en',
    businessName: 'Shop',
    mainInterest: 'sell_items',
    aiTokens: 0,
    tipsRemindersEnabled: true,
    canAcceptOrders: false,
    lifecycleStatus: 'contract_signed',
    hasExpoPush: true,
    approvedItemCount: 0,
    approvedRentalCount: 0,
    pendingItemCount: 0,
    rejectedItemCount: 0,
    hasLogo: false,
    hasOperatingHours: false,
    lastCatalogItemAt: null,
    itemsNeedingAiCleanupCount: 0,
    topViewedOutOfStockCount: 0,
    totalProductViews: 3,
    ordersTotal: 0,
    liveSince: null,
    needsPaymentSetupNudge: true,
    paymentSetupViewCount: 3,
    ...overrides,
  });

  it('requires tips enabled, views, and incomplete payment setup', () => {
    expect(isPaymentSetupNudgeDue(candidate(), now, undefined, 0)).toBe(true);
    expect(
      isPaymentSetupNudgeDue(
        candidate({ tipsRemindersEnabled: false }),
        now,
        undefined,
        0
      )
    ).toBe(false);
    expect(
      isPaymentSetupNudgeDue(
        candidate({ needsPaymentSetupNudge: false }),
        now,
        undefined,
        0
      )
    ).toBe(false);
    expect(
      isPaymentSetupNudgeDue(
        candidate({ paymentSetupViewCount: 0 }),
        now,
        undefined,
        0
      )
    ).toBe(false);
  });
});
