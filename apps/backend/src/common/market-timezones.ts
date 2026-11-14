/**
 * Server time zone for every market the assistant and rental dates can resolve.
 * A code missing from this map fails the rental readiness check.
 */
export const MARKET_TIME_ZONES: Record<string, string> = {
  CM: 'Africa/Douala',
  GA: 'Africa/Libreville',
  TG: 'Africa/Lome',
  BJ: 'Africa/Porto-Novo',
  CI: 'Africa/Abidjan',
  CG: 'Africa/Brazzaville',
  CD: 'Africa/Kinshasa',
  TD: 'Africa/Ndjamena',
  CF: 'Africa/Bangui',
  GQ: 'Africa/Malabo',
  PH: 'Asia/Manila',
  CA: 'America/Toronto',
  US: 'America/New_York',
};

export function marketTimeZone(countryCode: string | null | undefined): string | null {
  const code = (countryCode ?? '').trim().toUpperCase();
  return MARKET_TIME_ZONES[code] ?? null;
}

/** Markets in `codes` that have no server time zone. */
export function marketsMissingTimeZone(codes: string[]): string[] {
  return codes
    .map((code) => code.trim().toUpperCase())
    .filter((code) => code && !marketTimeZone(code));
}
