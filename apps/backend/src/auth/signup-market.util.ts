/** Keep in sync with frontend/mobile `marketCountries.ts`. */
export const AFRICAN_MARKET_COUNTRY_CODES = [
  'CM',
  'GA',
  'TG',
  'BJ',
  'CI',
  'CG',
] as const;

export function isAfricanMarketCountry(
  countryCode: string | null | undefined
): boolean {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  return (AFRICAN_MARKET_COUNTRY_CODES as readonly string[]).includes(code);
}
