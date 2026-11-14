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

  it('ignores a sub-cent gap, a blank quote, and a non-numeric total', () => {
    expect(shouldNotifyPriceChange(2500, 2500.009)).toBe(false);
    expect(shouldNotifyPriceChange('2500', '2500.01')).toBe(true);
    expect(shouldNotifyPriceChange(3000, 2500)).toBe(true);
    expect(shouldNotifyPriceChange('', 3000)).toBe(false);
    expect(shouldNotifyPriceChange('nope', 3000)).toBe(false);
    expect(shouldNotifyPriceChange(2500, null)).toBe(false);
  });

  it('keeps the quote when the override is negative, missing, or in another currency', () => {
    expect(applyAcceptedPrice(snap, { total: -1, currency: 'XAF' }).snapshot.total).toBe(2500);
    expect(applyAcceptedPrice(snap, { total: Number.NaN, currency: 'XAF' }).currencyMismatch).toBe(false);
    expect(applyAcceptedPrice(snap, null).snapshot.total).toBe(2500);
    const mismatch = applyAcceptedPrice(snap, { total: 3000, currency: 'CAD' });
    expect(mismatch.snapshot.total).toBe(2500);
    expect(mismatch.currencyMismatch).toBe(true);
    expect(applyAcceptedPrice(snap, { total: 3000.126, currency: 'XAF' }).snapshot.total).toBe(3000.13);
  });

  it('still blocks payment when the seen timestamp is blank', () => {
    expect(paymentBlockedUntilPriceSeen({ quoted: 2500, accepted: 3000, seenAt: '' })).toBe(true);
    expect(paymentBlockedUntilPriceSeen({ quoted: '2500', accepted: '2500.004', seenAt: null })).toBe(false);
  });
});
