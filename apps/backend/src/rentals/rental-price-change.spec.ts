import { applyAcceptedPrice, paymentBlockedUntilPriceSeen, priceChangeCopy, shouldNotifyPriceChange } from './rental-price-change';

const snap = {
  version: 4,
  currency: 'XAF',
  total: 2500,
  computedAt: '2026-11-13T00:00:00.000Z',
  lines: [],
};

describe('rental price change', () => {
  it('notifies only when the accepted total differs from the quote', () => {
    expect(shouldNotifyPriceChange(2500, 3000)).toBe(true);
    expect(shouldNotifyPriceChange(2500, 2500)).toBe(false);
    expect(shouldNotifyPriceChange(null, 3000)).toBe(false);
  });

  it('blocks payment until the renter has seen the new price', () => {
    expect(paymentBlockedUntilPriceSeen({ quoted: 2500, accepted: 3000, seenAt: null })).toBe(true);
    expect(paymentBlockedUntilPriceSeen({ quoted: 2500, accepted: 3000, seenAt: '2026-11-13T00:00:00.000Z' })).toBe(false);
    expect(paymentBlockedUntilPriceSeen({ quoted: 2500, accepted: 2500, seenAt: null })).toBe(false);
  });

  it('uses the business total and keeps the quote currency', () => {
    const changed = applyAcceptedPrice(snap, { total: 3000, currency: 'XAF' });
    expect(changed.snapshot.total).toBe(3000);
    expect(changed.currencyMismatch).toBe(false);
    expect(applyAcceptedPrice(snap, { total: 3000, currency: 'CAD' }).currencyMismatch).toBe(true);
    expect(priceChangeCopy('en', 'hammer', 2500, 3000).pushBody).toContain('hammer');
    expect(priceChangeCopy('fr', 'marteau', 2500, 3000).inApp).toContain('3\u00A0000');
  });
});
