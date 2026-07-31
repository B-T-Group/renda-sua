const ALLOWED_COUNTRY_CODES = new Set(['237', '241']);

/** ISO alpha-2 → calling code for supported mobile-money countries. */
const ISO_TO_CALLING: Record<string, string> = {
  CM: '237',
  GA: '241',
};

const CALLING_TO_ISO: Record<string, string> = {
  '237': 'CM',
  '241': 'GA',
};

/** Accepts dialing code (237) or ISO alpha-2 (CM); returns dialing code or null. */
export function toMobileMoneyCallingCode(
  countryOrCalling: string | undefined | null
): string | null {
  if (!countryOrCalling) return null;
  const trimmed = countryOrCalling.trim().toUpperCase();
  if (ISO_TO_CALLING[trimmed]) return ISO_TO_CALLING[trimmed];
  const digits = trimmed.replace(/\D/g, '');
  return ALLOWED_COUNTRY_CODES.has(digits) ? digits : null;
}

export function isoFromMobileMoneyCallingCode(
  callingCode: string
): string | null {
  return CALLING_TO_ISO[callingCode.replace(/\D/g, '')] ?? null;
}

export function normalizeToE164(
  countryCode: string,
  phoneNumber: string
): string | null {
  const cc =
    toMobileMoneyCallingCode(countryCode) ?? countryCode.replace(/\D/g, '');
  if (!ALLOWED_COUNTRY_CODES.has(cc)) return null;
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith(cc)) return `+${digits}`;
  return `+${cc}${digits}`;
}

export function parseE164(phoneE164: string): {
  countryCode: string;
  nationalNumber: string;
} | null {
  const trimmed = phoneE164.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  for (const cc of ALLOWED_COUNTRY_CODES) {
    if (digits.startsWith(cc)) {
      return { countryCode: cc, nationalNumber: digits.slice(cc.length) };
    }
  }
  return null;
}

export function isSupportedMobileMoneyE164(phoneE164: string): boolean {
  return parseE164(phoneE164) !== null;
}
