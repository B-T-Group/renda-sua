import {
  itemSubtotalAfterDiscounts,
  normalizeFeeCountryCode,
  percentFee,
} from './fee-percent.util';

/** Same vectors as apps/cdk/tests/test_cancellation_fee_util.py */
describe('fee-percent.util', () => {
  describe('percentFee (parity vectors with the Python lambda)', () => {
    const vectors: Array<[number, number, string, number]> = [
      [10000, 30, 'XAF', 3000],
      [3333, 30, 'XAF', 1000], // 999.9 -> 1000
      [1005, 30, 'XAF', 302], // 301.5 -> 302 (half-up)
      [10.05, 30, 'CAD', 3.02], // 3.015 -> 3.02 (half-up)
      [100, 0, 'CAD', 0],
      [0, 30, 'XAF', 0],
      [2500, 12.5, 'XAF', 313], // 312.5 -> 313
    ];
    it.each(vectors)('%p at %p%% in %s => %p', (base, pct, cur, expected) => {
      expect(percentFee(base, pct, cur)).toBe(expected);
    });
  });

  describe('itemSubtotalAfterDiscounts', () => {
    it('excludes delivery fee and tax and nets out discounts via total_amount', () => {
      // items 10000 - 1000 discount + delivery 1500 + tax 200 = 10700
      expect(
        itemSubtotalAfterDiscounts({
          total_amount: 10700,
          base_delivery_fee: 1000,
          per_km_delivery_fee: 500,
          delivery_fee_waived: false,
          tax_amount: 200,
        })
      ).toBe(9000);
    });

    it('does not subtract a waived delivery fee (customer paid 0)', () => {
      expect(
        itemSubtotalAfterDiscounts({
          total_amount: 9000,
          base_delivery_fee: 1000,
          per_km_delivery_fee: 500,
          delivery_fee_waived: true,
          tax_amount: 0,
        })
      ).toBe(9000);
    });

    it('accepts numeric strings and never goes negative', () => {
      expect(
        itemSubtotalAfterDiscounts({
          total_amount: '1000',
          base_delivery_fee: '1500',
          per_km_delivery_fee: '0',
        })
      ).toBe(0);
    });

    it('is 0 for NaN inputs', () => {
      expect(itemSubtotalAfterDiscounts({ total_amount: 'x' })).toBe(0);
    });
  });

  describe('normalizeFeeCountryCode', () => {
    it.each([
      ['CM', 'CM'],
      ['ga', 'GA'],
      ['Cameroon', 'CM'],
      ['Gabon', 'GA'],
      ['Canada', 'CA'],
      ['Narnia', null],
      ['', null],
      [null, null],
    ])('%p => %p', (input, expected) => {
      expect(normalizeFeeCountryCode(input as any)).toBe(expected);
    });
  });
});

describe('selectFeePercent', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { selectFeePercent } = require('./fee-percent.util');

  it('uses the country row, including an explicit 0 (Canada)', () => {
    const rows = [
      { country_code: 'CA', number_value: 0 },
      { country_code: null, number_value: 25 },
    ];
    expect(selectFeePercent(rows, 'CA')).toEqual({ percent: 0, source: 'country' });
  });

  it('falls back to the global row for a country without its own row', () => {
    expect(selectFeePercent([{ country_code: null, number_value: 25 }], 'TG')).toEqual({
      percent: 25,
      source: 'global',
    });
  });

  it('reports missing_default (30) when nothing is configured', () => {
    expect(selectFeePercent([], 'CM')).toEqual({ percent: 30, source: 'missing_default' });
    expect(selectFeePercent([], null)).toEqual({ percent: 30, source: 'missing_default' });
  });

  it.each([null, '', 'abc', -1, 101])('throws for invalid stored value %p', (v) => {
    expect(() => selectFeePercent([{ country_code: 'CM', number_value: v as any }], 'CM')).toThrow(
      /Invalid fee percent/
    );
  });
});
