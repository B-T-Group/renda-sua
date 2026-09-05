/** ISO alpha-2 for a catalog item: location address first, then owner country. */
export function resolveItemCountry(
  locationCountry?: string | null,
  ownerCountry?: string | null
): string | null {
  const location = locationCountry?.trim().toUpperCase() || null;
  if (location) return location;
  const owner = ownerCountry?.trim().toUpperCase() || null;
  return owner;
}

/**
 * MoMo integration for a market. Matches seeded `supported_payment_systems`:
 * CM → freemopay, otherwise MyPVit (GA airtel/moov).
 */
export function mapCountryToMobileMoneyProvider(
  country?: string | null
): 'freemopay' | 'mypvit' {
  const code = country?.trim().toUpperCase();
  if (code === 'CM') return 'freemopay';
  return 'mypvit';
}
