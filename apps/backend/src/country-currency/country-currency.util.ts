const GQL_CURRENCY_BY_COUNTRY = `
  query CurrencyByCountry($countryCode: String!) {
    supported_country_states(
      where: { country_code: { _eq: $countryCode } }
      limit: 1
    ) {
      currency_code
    }
  }
`;

export function normalizeCountryCode(
  country: string | null | undefined
): string | null {
  if (!country?.trim()) return null;
  const code = country.trim().toUpperCase().slice(0, 2);
  return code.length === 2 ? code : null;
}

type ExecuteQueryFn = (
  query: string,
  variables?: Record<string, unknown>
) => Promise<any>;

export async function resolveCurrencyFromCountry(
  country: string | null | undefined,
  executeQuery: ExecuteQueryFn
): Promise<string> {
  const countryCode = normalizeCountryCode(country);
  if (!countryCode) return 'XAF';

  try {
    const result = await executeQuery(GQL_CURRENCY_BY_COUNTRY, {
      countryCode,
    });
    const fromDb = result?.supported_country_states?.[0]?.currency_code;
    if (fromDb && typeof fromDb === 'string' && fromDb.trim()) {
      return fromDb.trim().toUpperCase();
    }
  } catch {
    // fall through to country-to-currency
  }

  try {
    const countryToCurrency = await import('country-to-currency');
    const currency = (countryToCurrency.default as Record<string, string>)[
      countryCode
    ];
    if (currency) return currency;
  } catch {
    // fall through
  }

  return 'XAF';
}
