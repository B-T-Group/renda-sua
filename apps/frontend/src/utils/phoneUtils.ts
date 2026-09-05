/**
 * Normalize national phone digits to E.164 format.
 * Ported from mobile app pattern.
 */

const COUNTRY_PHONE_PREFIXES: Record<string, string> = {
  CM: '+237',
  GA: '+241',
};

/**
 * Convert national phone digits to E.164 format based on country code.
 * @param nationalDigits - National phone number (e.g., "6 12 34 56 78" or "612345678")
 * @param countryCode - ISO country code (e.g., "CM", "GA")
 * @returns E.164 formatted phone number (e.g., "+237612345678")
 */
export function nationalDigitsToE164(
  nationalDigits: string,
  countryCode: string
): string {
  const prefix = COUNTRY_PHONE_PREFIXES[countryCode.toUpperCase()];
  if (!prefix) {
    throw new Error(`Unsupported country code for phone normalization: ${countryCode}`);
  }

  // Strip all non-digit characters
  const digitsOnly = nationalDigits.replace(/\D/g, '');
  
  if (!digitsOnly) {
    throw new Error('Phone number contains no digits');
  }

  // If already starts with country code, return as-is
  if (digitsOnly.startsWith(prefix.slice(1))) {
    return `+${digitsOnly}`;
  }

  return `${prefix}${digitsOnly}`;
}

/**
 * Validate that a phone number is in E.164 format.
 * @param phone - Phone number to validate
 * @returns true if valid E.164 format
 */
export function isE164(phone: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}
