export const ACTIVE_PHONE_COUNTRY_ISO_CODES = ['CM', 'GA', 'CA', 'US'] as const;

export type ActivePhoneCountryIsoCode = (typeof ACTIVE_PHONE_COUNTRY_ISO_CODES)[number];

export interface ActivePhoneCountryOption {
  isoCode: ActivePhoneCountryIsoCode;
  dialCode: string;
  flag: string;
}

const ACTIVE_PHONE_COUNTRY_DIAL_CODES: Record<ActivePhoneCountryIsoCode, string> = {
  CM: '237',
  GA: '241',
  CA: '1',
  US: '1',
};

function iso2ToFlag(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export function isActivePhoneCountry(countryCode: string | null | undefined): boolean {
  const normalized = String(countryCode || '').trim().toUpperCase();
  return ACTIVE_PHONE_COUNTRY_ISO_CODES.some((code) => code === normalized);
}

export function getDialCodeForActiveCountry(
  countryCode: string | null | undefined
): string | null {
  const normalized = String(countryCode || '').trim().toUpperCase();
  if (!isActivePhoneCountry(normalized)) return null;
  return ACTIVE_PHONE_COUNTRY_DIAL_CODES[normalized as ActivePhoneCountryIsoCode];
}

export const ACTIVE_PHONE_COUNTRY_OPTIONS: ActivePhoneCountryOption[] =
  ACTIVE_PHONE_COUNTRY_ISO_CODES.map((isoCode) => ({
    isoCode,
    dialCode: ACTIVE_PHONE_COUNTRY_DIAL_CODES[isoCode],
    flag: iso2ToFlag(isoCode),
  }));
