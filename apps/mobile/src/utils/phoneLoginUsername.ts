import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Formats national digits for display using the selected country. */
export function formatNationalForDisplay(countryIso: CountryCode, digitsOnly: string): string {
  const formatter = new AsYouType(countryIso);
  for (const ch of digitsOnly.replace(/\D/g, '')) {
    formatter.input(ch);
  }
  return formatter.getChars();
}

/** Returns E.164 if the number is valid for the selected country; otherwise null. */
export function nationalDigitsToE164(countryIso: CountryCode, digitsOnly: string): string | null {
  const cleaned = digitsOnly.replace(/\D/g, '');
  if (!cleaned) return null;
  const parsed = parsePhoneNumberFromString(cleaned, countryIso);
  if (!parsed?.isValid()) return null;
  return parsed.number;
}

/** Parse stored E.164 into country + national digits (for `PhoneNumberInput`). */
export function e164ToCountryAndNational(
  e164: string
): { countryIso: CountryCode; nationalDigits: string } | null {
  const trimmed = e164.trim();
  if (!trimmed) return null;
  const parsed = parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid() || !parsed.country) return null;
  return { countryIso: parsed.country, nationalDigits: String(parsed.nationalNumber) };
}

/** Seed a phone picker from stored E.164 or national digits. */
export function seedPhoneInputFromE164(
  raw: string | null | undefined,
  fallbackIso: CountryCode
): { countryIso: CountryCode; nationalDigits: string } {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { countryIso: fallbackIso, nationalDigits: '' };
  const parsed = e164ToCountryAndNational(trimmed);
  if (parsed) return parsed;
  const withRegion = parsePhoneNumberFromString(trimmed, fallbackIso);
  if (withRegion?.isValid() && withRegion.country) {
    return {
      countryIso: withRegion.country,
      nationalDigits: String(withRegion.nationalNumber),
    };
  }
  return { countryIso: fallbackIso, nationalDigits: trimmed.replace(/\D/g, '') };
}
