/**
 * Unauthenticated access to the supported-countries Nest endpoint, used to
 * restrict the phone country-code picker to countries the platform supports.
 */

import { publicApiGet } from './publicApiClient';

export interface SupportedCountry {
  code: string;
  name: string;
  currencyCode: string;
  serviceStatus: string;
  deliveryEnabled: boolean;
  supportedPaymentMethods: string[];
  /** When omitted (older backends), treat as signup-enabled. */
  signupEnabled?: boolean;
  postalCodeRequired?: boolean;
  verificationFlow?: string;
}

interface SupportedCountriesResponse {
  success: boolean;
  countries: SupportedCountry[];
}

let cache: Promise<SupportedCountry[]> | null = null;

async function fetchSupportedCountries(): Promise<SupportedCountry[]> {
  const res = await publicApiGet<SupportedCountriesResponse>(
    '/locations/supported-countries'
  );
  return res?.countries ?? [];
}

/** Cached so multiple phone inputs don't each hit the network. */
export function getSupportedCountries(): Promise<SupportedCountry[]> {
  if (!cache) {
    cache = fetchSupportedCountries().catch((err) => {
      cache = null;
      throw err;
    });
  }
  return cache;
}
