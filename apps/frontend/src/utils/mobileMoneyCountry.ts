const MOBILE_MONEY_COUNTRY_CODES = ['CM', 'GA', 'TG'] as const;

export type MobileMoneyCountryCode = (typeof MOBILE_MONEY_COUNTRY_CODES)[number];

/** Cameroon, Gabon, and Togo are the markets that collect payment by Mobile Money. */
export function isMobileMoneyCountry(country?: string | null): boolean {
  const code = (country || '').trim().toUpperCase();
  return (MOBILE_MONEY_COUNTRY_CODES as readonly string[]).includes(code);
}

/** MoMo catalog payments: default the country picker to the item/order location. */
export function pickMobileMoneyDefaultCountry(
  preferred?: string | null
): MobileMoneyCountryCode {
  const code = preferred?.trim().toUpperCase();
  if (code === 'GA') return 'GA';
  if (code === 'TG') return 'TG';
  return 'CM';
}
