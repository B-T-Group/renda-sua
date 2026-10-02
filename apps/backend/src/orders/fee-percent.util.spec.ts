import {
  itemSubtotalAfterDiscounts,
  normalizeFeeCountryCode,
  percentFee,
  resolveFeePercent,
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
      [10000, -5, 'XAF', 0],
      [10000, Number.NaN, 'XAF', 0],
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
      ['Cameroun', 'CM'],
      ["Côte d'Ivoire", 'CI'],
      ['Ivory Coast', 'CI'],
      ['Benin', 'BJ'],
      ['Bénin', 'BJ'],
      ['Togo', 'TG'],
      ['Congo', 'CG'],
      ['Philippines', 'PH'],
      ['USA', 'US'],
      ['United States', 'US'],
      ['  ga ', 'GA'],
      ['CMR', null],
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

  it('accepts a numeric string and an explicit 100', () => {
    expect(selectFeePercent([{ country_code: 'CM', number_value: '12.5' }], 'cm')).toEqual({
      percent: 12.5,
      source: 'country',
    });
    expect(selectFeePercent([{ country_code: 'GA', number_value: '100' }], 'GA')).toEqual({
      percent: 100,
      source: 'country',
    });
  });

  it('treats a blank country_code as the global row', () => {
    expect(selectFeePercent([{ country_code: '', number_value: 15 }], 'TG')).toEqual({
      percent: 15,
      source: 'global',
    });
  });
});

describe('resolveFeePercent', () => {
  const logger = () => ({ warn: jest.fn(), error: jest.fn() });

  it('omits $country when the country is missing and still uses the global row', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      application_configurations: [{ country_code: null, number_value: 20 }],
    });
    const log = logger();

    const resolved = await resolveFeePercent(
      { executeQuery },
      'cancellation_fee_percent',
      null,
      log,
      'cancellation_fee_config_missing',
      'order=order-1'
    );

    expect(resolved).toEqual({ percent: 20, source: 'global' });
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).not.toContain('$country');
    expect(query).toContain('country_code: { _is_null: true }');
    expect(vars).toEqual({ key: 'cancellation_fee_percent' });
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('fee_country_unknown'));
    expect(log.error).not.toHaveBeenCalledWith(
      expect.stringContaining('cancellation_fee_config_missing')
    );
  });

  it('binds a known country and prefers that row over the global default', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      application_configurations: [
        { country_code: null, number_value: 20 },
        { country_code: 'CM', number_value: 30 },
      ],
    });
    const log = logger();

    const resolved = await resolveFeePercent(
      { executeQuery },
      'failed_delivery_fee_percent',
      'CM',
      log,
      'failed_delivery_fee_config_missing',
      'order=ORD-1'
    );

    expect(resolved).toEqual({ percent: 30, source: 'country' });
    const [query, vars] = executeQuery.mock.calls[0];
    expect(query).toContain('$country: String!');
    expect(query).toContain('country_code: { _eq: $country }');
    expect(vars).toEqual({ key: 'failed_delivery_fee_percent', country: 'CM' });
    expect(log.error).not.toHaveBeenCalled();
  });

  it('logs missing_default when nothing is configured and does not waive to 0', async () => {
    const executeQuery = jest.fn().mockResolvedValue({ application_configurations: [] });
    const log = logger();

    const resolved = await resolveFeePercent(
      { executeQuery },
      'cancellation_fee_percent',
      'GA',
      log,
      'cancellation_fee_config_missing',
      'order=order-9'
    );

    expect(resolved).toEqual({ percent: 30, source: 'missing_default' });
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining('cancellation_fee_config_missing')
    );
  });

  it('throws on an invalid stored percent instead of waiving the fee', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      application_configurations: [{ country_code: 'CM', number_value: 101 }],
    });

    await expect(
      resolveFeePercent(
        { executeQuery },
        'cancellation_fee_percent',
        'CM',
        logger(),
        'cancellation_fee_config_missing',
        'order=order-1'
      )
    ).rejects.toThrow(/Invalid fee percent/);
  });

  it('propagates a Hasura read error', async () => {
    const executeQuery = jest.fn().mockRejectedValue(new Error('hasura down'));

    await expect(
      resolveFeePercent(
        { executeQuery },
        'cancellation_fee_percent',
        'CM',
        logger(),
        'cancellation_fee_config_missing',
        'order=order-1'
      )
    ).rejects.toThrow('hasura down');
  });
});
