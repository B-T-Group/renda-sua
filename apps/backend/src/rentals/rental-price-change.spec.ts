import {
  applyAcceptedPrice,
  businessChangedThePrice,
  paymentBlockedUntilPriceSeen,
  priceChangeCopy,
  quoteWithTotalOverride,
  shouldNotifyPriceChange,
} from './rental-price-change';

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

  it('H1 shows a price change only after the business has accepted', () => {
    expect(businessChangedThePrice('pending', 2500, 3000)).toBe(false);
    expect(businessChangedThePrice('available', 2500, 3000)).toBe(true);
    expect(businessChangedThePrice('available', 2500, 2500)).toBe(false);
  });

  it('H2 scales a positive override and rejects a disabled or empty one', () => {
    const priced = { ...snap, total: 15000, lines: [{ kind: 'hourly' as const, subtotal: 15000, billableHours: 3, ratePerHour: 2500, startAt: 'a', endAt: 'b' }] };
    expect(quoteWithTotalOverride(priced, null, false).total).toBe(15000);
    expect(quoteWithTotalOverride(priced, 12000, true).lines[0].subtotal).toBe(12000);
    expect(() => quoteWithTotalOverride(priced, 12000, false)).toThrow('TOTAL_OVERRIDE_DISABLED');
    expect(() => quoteWithTotalOverride(priced, 0, true)).toThrow('TOTAL_OVERRIDE_INVALID');
    expect(() => quoteWithTotalOverride(priced, 1e15, true)).toThrow('TOTAL_OVERRIDE_TOO_HIGH');
    expect(() => quoteWithTotalOverride(priced, 15000 * 10 + 1, true)).toThrow('TOTAL_OVERRIDE_TOO_HIGH');
  });

  it('N12 allows any total up to the quote and applies a per-currency ceiling only above it', () => {
    const quote = { ...snap, total: 2_000_000, lines: [{ kind: 'hourly' as const, subtotal: 2_000_000, billableHours: 1, ratePerHour: 2_000_000, startAt: 'a', endAt: 'b' }] };
    expect(quoteWithTotalOverride(quote, 1_800_000, true, 1_000_000).total).toBe(1_800_000);
    expect(() => quoteWithTotalOverride(quote, 5_000_000, true, 3_000_000)).toThrow('TOTAL_OVERRIDE_TOO_HIGH');
    expect(quoteWithTotalOverride(quote, 5_000_000, true, null).total).toBe(5_000_000);
  });

  it('N24 accepts any positive override when the quote is 0 and no ceiling is set', () => {
    const free = { ...snap, total: 0, lines: [] as typeof snap.lines };
    expect(quoteWithTotalOverride(free, 1_000_000, true, null).total).toBe(1_000_000);
    expect(quoteWithTotalOverride(free, 40_000, true, 50_000).total).toBe(40_000);
    expect(() => quoteWithTotalOverride(free, 60_000, true, 50_000)).toThrow('TOTAL_OVERRIDE_TOO_HIGH');
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

  it('keeps the server total when the business snapshot omits units', () => {
    const computed = {
      ...snap,
      total: 10000,
      unitsBooked: 2,
      lines: [{ kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 10000 }],
    };
    const sent = {
      total: 5000,
      currency: 'XAF',
      lines: [{ subtotal: 5000 }],
    };
    expect(applyAcceptedPrice(computed, sent).snapshot.total).toBe(10000);
    expect(applyAcceptedPrice(computed, { total: 3000, currency: 'XAF', lines: [{ subtotal: 5000 }] }).snapshot.total).toBe(3000);
  });

  it('keeps the server total when every line is one unit of a multi-unit booking', () => {
    const computed = {
      ...snap,
      total: 15000,
      unitsBooked: 2,
      lines: [
        { kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 10000 },
        { kind: 'hourly' as const, subtotal: 5000, billableHours: 2, ratePerHour: 1250, startAt: 'a', endAt: 'b' },
      ],
    };
    const kept = applyAcceptedPrice(computed, {
      total: 7500,
      currency: 'XAF',
      lines: [{ subtotal: 5000 }, { subtotal: 2500 }],
    });
    expect(kept.snapshot.total).toBe(15000);
    expect(kept.currencyMismatch).toBe(false);
  });

  it('keeps the server total when the line count differs but the amount is still one unit', () => {
    const computed = {
      ...snap,
      total: 10000,
      unitsBooked: 2,
      lines: [
        { kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 2500, subtotal: 5000 },
        { kind: 'all_day' as const, calendarDate: '2026-11-15', ratePerDay: 2500, subtotal: 5000 },
      ],
    };
    expect(applyAcceptedPrice(computed, {
      total: 5000,
      currency: 'XAF',
      lines: [{ subtotal: 5000 }],
    }).snapshot.total).toBe(10000);
  });

  it('charges a real discount when the sent lines are not one unit of the server total', () => {
    const computed = {
      ...snap,
      total: 10000,
      unitsBooked: 2,
      lines: [
        { kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 2500, subtotal: 5000 },
        { kind: 'all_day' as const, calendarDate: '2026-11-15', ratePerDay: 2500, subtotal: 5000 },
      ],
    };
    expect(applyAcceptedPrice(computed, {
      total: 4000,
      currency: 'XAF',
      lines: [{ subtotal: 4000 }],
    }).snapshot.total).toBe(4000);
    expect(applyAcceptedPrice(computed, {
      total: 4000,
      currency: 'XAF',
      lines: [{ subtotal: 2000 }, { subtotal: 2000 }],
    }).snapshot.total).toBe(4000);
  });

  it('charges a one-unit discount and does not throw when the unit count is missing', () => {
    const one = {
      ...snap,
      total: 5000,
      unitsBooked: 1,
      lines: [{ kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 5000 }],
    };
    expect(applyAcceptedPrice(one, {
      total: 4000,
      currency: 'XAF',
      lines: [{ subtotal: 4000 }],
    }).snapshot.total).toBe(4000);
    const missing = {
      ...snap,
      total: 5000,
      lines: [{ kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 5000 }],
    };
    expect(applyAcceptedPrice(missing, {
      total: 4000,
      currency: 'XAF',
      lines: [{ subtotal: 4000 }],
    }).snapshot.total).toBe(4000);
    expect(applyAcceptedPrice({ ...missing, unitsBooked: Number.NaN }, {
      total: 4000,
      currency: 'XAF',
      lines: [{ subtotal: 4000 }],
    }).snapshot.total).toBe(4000);
  });

  it('floors the unit count and ignores one-unit lines inside a two-cent tolerance', () => {
    const computed = {
      ...snap,
      total: 10000,
      unitsBooked: 2.9,
      lines: [{ kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 10000 }],
    };
    expect(applyAcceptedPrice(computed, {
      total: 5000,
      currency: 'XAF',
      lines: [{ subtotal: 5000 }],
    }).snapshot.total).toBe(10000);
    const asText = { ...computed, unitsBooked: '2' as unknown as number };
    expect(applyAcceptedPrice(asText, {
      total: 5000.01,
      currency: 'XAF',
      lines: [{ subtotal: 5000.01 }],
    }).snapshot.total).toBe(10000);
    expect(applyAcceptedPrice(asText, {
      total: 5000.05,
      currency: 'XAF',
      lines: [{ subtotal: 5000.05 }],
    }).snapshot.total).toBe(5000.05);
  });

  it('keeps the quote on a currency mismatch even when the lines look like one unit', () => {
    const computed = {
      ...snap,
      total: 10000,
      unitsBooked: 2,
      lines: [{ kind: 'all_day' as const, calendarDate: '2026-11-14', ratePerDay: 5000, subtotal: 10000 }],
    };
    const mismatch = applyAcceptedPrice(computed, {
      total: 5000,
      currency: 'CAD',
      lines: [{ subtotal: 5000 }],
    });
    expect(mismatch.snapshot.total).toBe(10000);
    expect(mismatch.currencyMismatch).toBe(true);
  });

  it('puts the leftover cent on the last line so the lines still sum to the override', () => {
    const priced = {
      ...snap,
      total: 30.01,
      lines: [
        { kind: 'hourly' as const, subtotal: 10, billableHours: 1, ratePerHour: 10, startAt: 'a', endAt: 'b' },
        { kind: 'hourly' as const, subtotal: 10, billableHours: 1, ratePerHour: 10, startAt: 'a', endAt: 'b' },
        { kind: 'hourly' as const, subtotal: 10.01, billableHours: 1, ratePerHour: 10.01, startAt: 'a', endAt: 'b' },
      ],
    };
    const next = quoteWithTotalOverride(priced, 10, true);
    expect(next.lines.map((line) => line.subtotal)).toEqual([3.33, 3.33, 3.34]);
  });
});
