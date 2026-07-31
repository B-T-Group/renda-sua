const ALLOWED_COUNTRY_CODES = new Set(['237', '241']);

export function normalizeToE164(
  countryCode: string,
  phoneNumber: string
): string | null {
  const cc = countryCode.replace(/\D/g, '');
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
