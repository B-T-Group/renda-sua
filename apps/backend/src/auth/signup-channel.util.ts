const AFRICAN_MARKET_COUNTRY_CODES = [
  'CM',
  'GA',
  'TG',
  'BJ',
  'CI',
  'CG',
] as const;

export type SignupOtpChannel = 'email' | 'sms';

export function isAfricanMarketCountry(
  countryCode: string | null | undefined
): boolean {
  const code = String(countryCode || '')
    .trim()
    .toUpperCase();
  return (AFRICAN_MARKET_COUNTRY_CODES as readonly string[]).includes(code);
}

/**
 * Prefer SMS for African markets when a phone is present; otherwise email.
 */
export function resolveSignupOtpChannel(input: {
  email?: string | null;
  phoneNumber?: string | null;
  country?: string | null;
  preferred?: SignupOtpChannel | null;
}): SignupOtpChannel {
  if (input.preferred === 'sms' && input.phoneNumber) return 'sms';
  if (input.preferred === 'email' && input.email) return 'email';
  if (
    input.phoneNumber &&
    isAfricanMarketCountry(input.country)
  ) {
    return 'sms';
  }
  if (input.email) return 'email';
  if (input.phoneNumber) return 'sms';
  throw new Error('Email or phone number is required for OTP channel');
}
