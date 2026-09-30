import { resolveCurrencyFromCountry } from './country-currency.util';

describe('resolveCurrencyFromCountry', () => {
  it('queries supported_country_states with a bpchar country code', async () => {
    const executeQuery = jest.fn().mockResolvedValue({
      supported_country_states: [{ currency_code: 'XAF' }],
    });

    const currency = await resolveCurrencyFromCountry('cm', executeQuery);

    expect(currency).toBe('XAF');
    expect(executeQuery).toHaveBeenCalledTimes(1);
    const [query, variables] = executeQuery.mock.calls[0];
    expect(String(query)).toContain('$countryCode: bpchar!');
    expect(String(query)).not.toContain('$countryCode: String!');
    expect(variables).toEqual({ countryCode: 'CM' });
  });
});
