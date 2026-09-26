import {
  appliedPurchaseCredit,
  isCampaignPurchaseCredit,
  isUsablePurchaseCredit,
  purchaseCreditShopTarget,
  storeShowsCreditPartnerBadge,
  summarizeUsableCredits,
} from './purchaseCredits';
import type { PurchaseCreditGrant } from '../types/purchaseCredits';

describe('purchaseCredits utils', () => {
  const base: PurchaseCreditGrant = {
    id: '1',
    currency: 'XAF',
    amount: 5000,
    remaining_amount: 3000,
    applicability: 'any_store',
    business_id: null,
    expires_at: null,
    memo: 'Welcome',
    source: 'campaign',
  };

  it('treats remaining positive non-revoked grants as usable', () => {
    expect(isUsablePurchaseCredit(base)).toBe(true);
    expect(isUsablePurchaseCredit({ ...base, remaining_amount: 0 })).toBe(false);
    expect(isUsablePurchaseCredit({ ...base, revoked_at: '2026-01-01' })).toBe(false);
  });

  it('applies store credit up to item subtotal and order total', () => {
    expect(
      appliedPurchaseCredit({
        itemSubtotal: 2000,
        orderTotal: 2500,
        creditTotal: 5000,
        depositNow: 150,
      })
    ).toEqual({ applied: 2000, remaining: 500, dueAtFulfillment: 350 });
  });

  it('rejects expired grants', () => {
    expect(
      isUsablePurchaseCredit({ ...base, expires_at: '2020-01-01T00:00:00.000Z' })
    ).toBe(false);
  });

  it('detects campaign grants', () => {
    expect(isCampaignPurchaseCredit(base)).toBe(true);
    expect(isCampaignPurchaseCredit({ ...base, source: 'admin' })).toBe(false);
  });

  it('maps shop targets by applicability', () => {
    expect(purchaseCreditShopTarget(base)).toEqual({ kind: 'browse' });
    expect(
      purchaseCreditShopTarget({
        ...base,
        applicability: 'partner_businesses',
      })
    ).toEqual({ kind: 'partners' });
    expect(
      purchaseCreditShopTarget({
        ...base,
        applicability: 'specific_business',
        business_id: 'biz-1',
        business: { id: 'biz-1', name: 'Partner' },
      })
    ).toEqual({ kind: 'store', businessId: 'biz-1' });
    expect(
      purchaseCreditShopTarget({
        ...base,
        applicability: 'specific_business',
        business_id: 'biz-fallback',
        business: null,
      })
    ).toEqual({ kind: 'store', businessId: 'biz-fallback' });
  });

  it('summarizes usable credits', () => {
    const summary = summarizeUsableCredits([
      base,
      { ...base, id: '2', remaining_amount: 1000 },
      { ...base, id: '3', remaining_amount: 0 },
    ]);
    expect(summary.totalRemaining).toBe(4000);
    expect(summary.usable).toHaveLength(2);
  });

  it('shows partner badge for matching stores', () => {
    const partnerGrant: PurchaseCreditGrant = {
      ...base,
      applicability: 'partner_businesses',
    };
    expect(
      storeShowsCreditPartnerBadge(
        { business_id: 'p1', is_partner: true },
        [partnerGrant]
      )
    ).toBe(true);
    expect(
      storeShowsCreditPartnerBadge(
        { business_id: 'p2', is_partner: false },
        [partnerGrant]
      )
    ).toBe(false);
    expect(
      storeShowsCreditPartnerBadge(
        { business_id: 'named-store', is_partner: false },
        [
          {
            ...base,
            applicability: 'specific_business',
            business_id: 'named-store',
          },
        ]
      )
    ).toBe(true);
    expect(
      storeShowsCreditPartnerBadge(
        { business_id: 'named-store', is_partner: true },
        [
          {
            ...base,
            applicability: 'specific_business',
            business_id: 'named-store',
            revoked_at: '2026-01-01',
          },
        ]
      )
    ).toBe(false);
  });
});
