import { marketTimeZone } from '../../common/market-timezones';
import { isoCountryCode } from '../../orders/delivery-pricing.util';

const FALLBACK_ZONE = 'Africa/Douala';

/** Listing market zone. An unknown country uses Africa/Douala, matching rental search. */
export function listingTimeZone(country: string | null | undefined): string {
  return marketTimeZone(isoCountryCode(country)) ?? FALLBACK_ZONE;
}
