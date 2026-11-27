import {
  calculateRentalCommission,
  commissionMinor,
  fromMinorUnits,
  toMinorUnits,
} from './rental-commission.calculator';

describe('calculateRentalCommission', () => {
  const vectors: Array<[string, number, number, string, number, number]> = [
    ['XAF 10,000 at 15%', 10000, 1500, 'XAF', 1500, 8500],
    ['XAF 3,330 at 15%', 3330, 1500, 'XAF', 500, 2830],
    ['XAF 3,329 rounds down', 3329, 1500, 'XAF', 499, 2830],
    ['XAF 3 rounds to zero', 3, 1500, 'XAF', 0, 3],
    ['XAF 150 rounds up', 150, 1500, 'XAF', 23, 127],
    ['CAD 0.99', 0.99, 1500, 'CAD', 0.15, 0.84],
    ['CAD 33.33', 33.33, 1500, 'CAD', 5, 28.33],
    ['USD 19.99 at 12.5%', 19.99, 1250, 'USD', 2.5, 17.49],
    ['XAF early adopter 10%', 25000, 1000, 'XAF', 2500, 22500],
    ['zero rate', 5000, 0, 'XAF', 0, 5000],
    ['full rate', 5000, 10000, 'XAF', 5000, 0],
  ];

  it.each(vectors)('%s', (_name, base, bps, currency, commission, payout) => {
    const split = calculateRentalCommission(base, bps, currency);
    expect(split.commissionAmount).toBe(commission);
    expect(split.merchantPayoutAmount).toBe(payout);
    expect(split.baseAmount).toBe(base);
  });

  it('never goes negative for a zero or negative base', () => {
    expect(calculateRentalCommission(0, 1500, 'XAF').commissionAmount).toBe(0);
    expect(calculateRentalCommission(-50, 1500, 'XAF').merchantPayoutAmount).toBe(0);
  });

  it('rejects a rate that is not whole basis points between 0 and 10000', () => {
    expect(() => calculateRentalCommission(100, 1500.5, 'XAF')).toThrow();
    expect(() => calculateRentalCommission(100, -1, 'XAF')).toThrow();
    expect(() => calculateRentalCommission(100, 10001, 'XAF')).toThrow();
  });

  it('keeps commission + payout equal to the base for every XAF base and rate sampled', () => {
    for (let base = 0; base <= 4000; base += 7) {
      for (const bps of [0, 1, 500, 1000, 1250, 1500, 1999, 10000]) {
        const split = calculateRentalCommission(base, bps, 'XAF');
        expect(split.commissionAmount + split.merchantPayoutAmount).toBe(base);
        expect(split.commissionAmount).toBeGreaterThanOrEqual(0);
        expect(split.commissionAmount).toBeLessThanOrEqual(base);
      }
    }
  });

  it('keeps the split exact in two-decimal currencies', () => {
    for (let cents = 0; cents <= 3000; cents += 13) {
      const base = cents / 100;
      const split = calculateRentalCommission(base, 1500, 'CAD');
      const sum = toMinorUnits(split.commissionAmount, 'CAD') + toMinorUnits(split.merchantPayoutAmount, 'CAD');
      expect(sum).toBe(BigInt(cents));
    }
  });

  it('does not lose precision on a very large base', () => {
    const base = 9_007_199_254_740_993n;
    expect(commissionMinor(base, 1500)).toBe((base * 1500n + 5000n) / 10000n);
  });
});

describe('minor unit conversion', () => {
  it('round-trips amounts without float drift', () => {
    expect(toMinorUnits(0.1 + 0.2, 'CAD')).toBe(30n);
    expect(toMinorUnits('1234.5', 'USD')).toBe(123450n);
    expect(toMinorUnits(1500, 'XAF')).toBe(1500n);
    expect(fromMinorUnits(30n, 'CAD')).toBe(0.3);
    expect(fromMinorUnits(5n, 'CAD')).toBe(0.05);
    expect(fromMinorUnits(1500n, 'XOF')).toBe(1500);
  });
});
