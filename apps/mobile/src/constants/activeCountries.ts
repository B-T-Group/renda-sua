export const ACTIVE_PHONE_COUNTRY_ISO_CODES = [
  'CM',
  'GA',
  'TG',
  'BJ',
  'CI',
  'CG',
  'CA',
  'US',
] as const;

export type ActivePhoneCountryIsoCode =
  (typeof ACTIVE_PHONE_COUNTRY_ISO_CODES)[number];

function iso2ToFlag(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
}

export const ACTIVE_PHONE_COUNTRY_OPTIONS = ACTIVE_PHONE_COUNTRY_ISO_CODES.map(
  (isoCode) => ({
    isoCode,
    flag: iso2ToFlag(isoCode),
  })
);
