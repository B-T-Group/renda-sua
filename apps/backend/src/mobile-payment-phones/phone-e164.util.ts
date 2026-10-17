export const ALLOWED_COUNTRY_CODES = new Set(['237', '241', '228']);

/** ISO alpha-2 → calling code for supported mobile-money countries. */
export const ISO_TO_CALLING: Record<string, string> = {
  CM: '237',
  GA: '241',
  TG: '228',
};

export const CALLING_TO_ISO: Record<string, string> = {
  '237': 'CM',
  '241': 'GA',
  '228': 'TG',
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

/** Format a phone number to E164 format. Alias for normalizeToE164 with swapped params. */
export function formatE164Phone(
  phoneNumber: string,
  countryCode: string
): string | null {
  return normalizeToE164(countryCode, phoneNumber);
}

/** Parse E164 phone with ISO code included. Also handles numbers without + prefix. */
export function parseE164Phone(phoneE164: string): {
  callingCode: string;
  nationalNumber: string;
  iso: string;
  e164: string;
} | null {
  if (!phoneE164) return null;
  const trimmed = phoneE164.trim();
  
  // Reject malformed numbers with special characters or multiple + signs
  if (trimmed.match(/[^+0-9]/)) return null;
  if ((trimmed.match(/\+/g) || []).length > 1) return null;
  
  // Try with + prefix first
  let parsed = parseE164(trimmed);
  
  // If failed and doesn't have +, try adding it
  if (!parsed && !trimmed.startsWith('+')) {
    parsed = parseE164(`+${trimmed}`);
  }
  
  if (!parsed) return null;
  const iso = isoFromMobileMoneyCallingCode(parsed.countryCode);
  if (!iso) return null;
  
  // Return normalized E164 format with +
  const e164 = `+${parsed.countryCode}${parsed.nationalNumber}`;
  return {
    callingCode: parsed.countryCode,
    nationalNumber: parsed.nationalNumber,
    iso,
    e164,
  };
}
