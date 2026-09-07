import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

export type PhoneCountryOption = {
  iso: CountryCode;
  callingCode: string;
  name: string;
};

/** Hermes / some RN builds omit `Intl.DisplayNames` — use a tiny shim. */
type RegionNames = { of: (region: string) => string | undefined };

function makeRegionNames(locale: string): RegionNames {
  type DisplayNamesCtor = new (locales: string | string[], options: { type: 'region' }) => RegionNames;
  const Ctor = (Intl as typeof Intl & { DisplayNames?: DisplayNamesCtor }).DisplayNames;
  if (typeof Ctor === 'function') {
    try {
      return new Ctor([locale], { type: 'region' });
    } catch {
      try {
        return new Ctor(['en'], { type: 'region' });
      } catch {
        /* use shim */
      }
    }
  }
  return { of: (region: string) => region };
}

/** Human-readable country name for an ISO2 code in the given locale. */
export function getCountryDisplayName(locale: string, iso: string): string {
  return makeRegionNames(locale).of(iso) ?? iso;
}

export function buildSortedPhoneCountryOptions(
  locale: string,
  allowedIsos?: CountryCode[]
): PhoneCountryOption[] {
  const displayNames = makeRegionNames(locale);
  const allowSet =
    allowedIsos && allowedIsos.length > 0 ? new Set(allowedIsos) : null;
  const isoList = allowSet
    ? getCountries().filter((iso) => allowSet.has(iso))
    : getCountries();
  const options: PhoneCountryOption[] = isoList.map((iso) => ({
    iso,
    callingCode: getCountryCallingCode(iso),
    name: displayNames.of(iso) ?? iso,
  }));
  options.sort((a, b) => a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
  return options;
}
