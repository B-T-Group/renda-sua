import { parsePhoneNumber } from 'libphonenumber-js';

/**
 * Resolve the country ISO code for Mobile Money display label.
 * 
 * Priority order (BUYER-FIRST, first non-empty wins):
 * 1. User profile country (from meUser.country) - BUYER
 * 2. Phone ISO extracted from user's E.164 phone number - BUYER
 * 3. Selected delivery address country - only if buyer fields missing
 * 4. Preflight delivery_country (server-authoritative market country) - only if buyer fields missing
 * 
 * CRITICAL: NEVER uses seller country or provisional cart country.
 * This ensures GA buyers (+241) see "MoMo · Gabon" even when picking up from a CM seller.
 * The label says "Based on your country" = BUYER country, not seller.
 * 
 * @param params - Resolution parameters
 * @returns ISO country code (2 letters) or undefined
 */
export function resolveMoMoDisplayCountryIso(params: {
  selectedAddressCountry?: string | null;
  preflightDeliveryCountry?: string | null;
  userCountry?: string | null;
  userPhone?: string | null;
}): string | undefined {
  const { selectedAddressCountry, preflightDeliveryCountry, userCountry, userPhone } = params;
  
  // 1. User profile country (from meUser.country) - BUYER FIRST
  const trimmedUserCountry = userCountry?.trim().toUpperCase();
  if (trimmedUserCountry && trimmedUserCountry.length === 2) {
    return trimmedUserCountry;
  }
  
  // 2. Extract ISO from user's phone number (E.164) - BUYER SECOND
  if (userPhone) {
    try {
      const parsed = parsePhoneNumber(userPhone);
      if (parsed?.country) {
        return parsed.country;
      }
    } catch {
      // Invalid phone, continue
    }
  }
  
  // 3. Selected delivery address country - only if buyer fields missing
  const trimmedAddress = selectedAddressCountry?.trim().toUpperCase();
  if (trimmedAddress && trimmedAddress.length === 2) {
    return trimmedAddress;
  }
  
  // 4. Preflight delivery_country (server-authoritative) - only if buyer fields missing
  const trimmedPreflight = preflightDeliveryCountry?.trim().toUpperCase();
  if (trimmedPreflight && trimmedPreflight.length === 2) {
    return trimmedPreflight;
  }
  
  return undefined;
}
