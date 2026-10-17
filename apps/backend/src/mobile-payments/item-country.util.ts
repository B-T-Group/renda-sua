import { isoCountryCode } from '../orders/delivery-pricing.util';

/** ISO alpha-2 for a catalog item: location address first, then owner country. */
export function resolveItemCountry(
  locationCountry?: string | null,
  ownerCountry?: string | null
): string | null {
  const location = locationCountry?.trim() || null;
  if (location) return isoCountryCode(location) ?? location.toUpperCase();
  const owner = ownerCountry?.trim() || null;
  return owner ? isoCountryCode(owner) ?? owner.toUpperCase() : null;
}

/**
 * MoMo integration for a market. Matches seeded `supported_payment_systems`:
 * CM → freemopay, TG → fedapay (when active), otherwise MyPVit (GA airtel/moov).
 */
export function mapCountryToMobileMoneyProvider(
  country?: string | null
): 'freemopay' | 'mypvit' | 'fedapay' {
  const iso = isoCountryCode(country);
  if (iso === 'CM') return 'freemopay';
  if (iso === 'TG') return 'fedapay';
  return 'mypvit';
}
