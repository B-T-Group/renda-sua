type CountryCurrencyHint = {
  code?: string | null;
  currencyCode?: string | null;
};

/**
 * Locks catalog currency to the business country when onboarding config
 * is missing. West African CFA (TG/BJ/CI) is XOF; Central African CFA is XAF.
 */
export function resolveCurrencyForCountry(
  country: string | null | undefined,
  countries: CountryCurrencyHint[]
): string {
  if (!country?.trim()) return 'XAF';
  const code = country.trim().toUpperCase().slice(0, 2);
  const match = countries.find((c) => c.code?.toUpperCase() === code);
  if (match?.currencyCode?.trim()) {
    return match.currencyCode.trim().toUpperCase();
  }
  if (code === 'CA') return 'CAD';
  if (code === 'US') return 'USD';
  if (['TG', 'BJ', 'CI'].includes(code)) return 'XOF';
  if (['GA', 'CM', 'TD', 'CF', 'CG', 'GQ'].includes(code)) return 'XAF';
  return 'XAF';
}
