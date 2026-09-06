import type { DeliveryAddressFormValue } from '../components/forms/DeliveryAddressForm';
import { AFRICAN_MARKET_COUNTRY_CODES } from '../constants/marketCountries';
import type { UserAddress } from '../types/agent';

/** Countries where postal code is not collected in the address form. */
const POSTAL_OPTIONAL_COUNTRIES = new Set<string>(AFRICAN_MARKET_COUNTRY_CODES);

export type AddressCompletenessField =
  | 'address_line_1'
  | 'city'
  | 'state'
  | 'country'
  | 'postal_code';

type AddressLike = Partial<
  Pick<
    UserAddress | DeliveryAddressFormValue,
    'address_line_1' | 'city' | 'state' | 'country' | 'postal_code'
  >
>;

function trimmed(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function requiresPostalCode(country: string): boolean {
  return !POSTAL_OPTIONAL_COUNTRIES.has(country.toUpperCase());
}

/** Fields missing for a complete address (postal skipped for African markets). */
export function missingAddressFields(address: AddressLike | null | undefined): AddressCompletenessField[] {
  if (!address) {
    return ['address_line_1', 'city', 'state', 'country', 'postal_code'];
  }
  const missing: AddressCompletenessField[] = [];
  if (!trimmed(address.address_line_1)) missing.push('address_line_1');
  if (!trimmed(address.city)) missing.push('city');
  if (!trimmed(address.state)) missing.push('state');
  if (!trimmed(address.country)) missing.push('country');
  const country = trimmed(address.country);
  if (requiresPostalCode(country) && !trimmed(address.postal_code)) {
    missing.push('postal_code');
  }
  return missing;
}

export function isAddressComplete(address: AddressLike | null | undefined): boolean {
  return missingAddressFields(address).length === 0;
}

export function toDeliveryAddressFormValue(
  address: UserAddress | null | undefined
): DeliveryAddressFormValue {
  return {
    address_line_1: address?.address_line_1 ?? '',
    address_line_2: address?.address_line_2 ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    postal_code: address?.postal_code ?? '',
    country: address?.country ?? '',
    latitude: address?.latitude ? Number(address.latitude) : undefined,
    longitude: address?.longitude ? Number(address.longitude) : undefined,
  };
}

export function pickPrimaryOrFirstAddress(
  addresses: UserAddress[]
): UserAddress | null {
  if (!addresses.length) return null;
  return addresses.find((a) => a.is_primary) ?? addresses[0] ?? null;
}
