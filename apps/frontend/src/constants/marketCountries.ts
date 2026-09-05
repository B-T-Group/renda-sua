/**
 * Hardcoded market allowlists used when API onboarding config is unavailable
 * or for UX rules (postal optional, SMS signup, CFA currency fallbacks).
 * Keep in sync with country_onboarding_configs / supported_country_states.
 */

/** African markets with national_id verification and optional postal codes. */
export const AFRICAN_MARKET_COUNTRY_CODES = [
  'CM',
  'GA',
  'TG',
  'BJ',
  'CI',
  'CG',
] as const;

export type AfricanMarketCountryCode =
  (typeof AFRICAN_MARKET_COUNTRY_CODES)[number];

/** Signup markets (African + Stripe rails). */
export const SIGNUP_COUNTRY_CODES = [
  ...AFRICAN_MARKET_COUNTRY_CODES,
  'US',
  'CA',
] as const;

export type SignupCountryCode = (typeof SIGNUP_COUNTRY_CODES)[number];

export function isAfricanMarketCountry(
  countryCode: string | null | undefined
): boolean {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  return (AFRICAN_MARKET_COUNTRY_CODES as readonly string[]).includes(code);
}

export function isSignupCountryCode(
  countryCode: string | null | undefined
): boolean {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  return (SIGNUP_COUNTRY_CODES as readonly string[]).includes(code);
}
