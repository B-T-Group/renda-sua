export const BUSINESS_REFERRAL_PAYOUT_CUTOFF_DATE = '2026-04-01';
export const BUSINESS_REFERRAL_PAYOUT_MIN_ITEMS = 10;

export const PAYOUT_CURRENCY_BY_COUNTRY: Record<string, string> = {
  GA: 'XAF',
  CM: 'XAF',
  CA: 'CAD',
  US: 'USD',
};

export function currencyForReferralPayout(countryCode: string | null): string {
  const code = (countryCode ?? '').toUpperCase();
  return PAYOUT_CURRENCY_BY_COUNTRY[code] ?? 'XAF';
}
