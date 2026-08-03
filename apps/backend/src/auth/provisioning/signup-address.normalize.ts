export interface NormalizedSignupAddress {
  address_line_1: string;
  country: string;
  city: string;
  state: string;
  postal_code: string;
  latitude?: number;
  longitude?: number;
  /** True when only country was provided (no street/city) — timezone/currency seed. */
  countryOnly: boolean;
}

export interface SignupAddressInput {
  country?: string;
  store_location?: {
    street: string;
    city: string;
    region: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
  /** @deprecated legacy mobile / in-flight shape */
  address?: {
    address_line_1: string;
    country: string;
    city: string;
    state: string;
    postal_code?: string;
    latitude?: number;
    longitude?: number;
  };
}

function resolveCountryCode(input: SignupAddressInput): string {
  return (
    input.country?.trim().toUpperCase() ||
    input.address?.country?.trim().toUpperCase() ||
    ''
  );
}

/**
 * Prefer `store_location` + resolvable country (top-level or legacy address.country);
 * fall back to legacy `address`. Country-only (empty street/city) is preserved for
 * agent/client timezone seeding.
 */
export function normalizeSignupAddress(
  input: SignupAddressInput
): NormalizedSignupAddress | undefined {
  const country = resolveCountryCode(input);

  if (input.store_location && country) {
    return {
      address_line_1: input.store_location.street.trim(),
      country,
      city: input.store_location.city.trim(),
      state: input.store_location.region.trim(),
      postal_code: (input.store_location.postal_code || '').trim(),
      latitude: input.store_location.latitude,
      longitude: input.store_location.longitude,
      countryOnly: false,
    };
  }

  if (input.address) {
    const addressCountry = input.address.country.trim().toUpperCase();
    const line1 = (input.address.address_line_1 || '').trim();
    const city = (input.address.city || '').trim();
    const state = (input.address.state || '').trim();
    const countryOnly = !line1 && !city;
    return {
      address_line_1: line1,
      country: addressCountry,
      city,
      state,
      postal_code: (input.address.postal_code || '').trim(),
      latitude: input.address.latitude,
      longitude: input.address.longitude,
      countryOnly,
    };
  }

  if (country) {
    return {
      address_line_1: '',
      country,
      city: '',
      state: '',
      postal_code: '',
      countryOnly: true,
    };
  }

  return undefined;
}
