/** Countries whose +codes the backend can route to a Mobile Money provider. */
export const MOBILE_MONEY_COUNTRY_CODES = ['CM', 'GA', 'TG'] as const;

export type MobileMoneyCountryCode = (typeof MOBILE_MONEY_COUNTRY_CODES)[number];

const CALLING_CODE_BY_ISO: Record<MobileMoneyCountryCode, string> = {
  CM: '237',
  GA: '241',
  TG: '228',
};

/** Cameroon, Gabon, and Togo collect payment by Mobile Money. */
export function isMobileMoneyCountry(country?: string | null): boolean {
  const code = (country || '').trim().toUpperCase();
  return (MOBILE_MONEY_COUNTRY_CODES as readonly string[]).includes(code);
}

/** MoMo catalog payments: default the country picker to the item/order location. */
export function pickMobileMoneyDefaultCountry(
  preferred?: string | null,
  allowed: readonly string[] = MOBILE_MONEY_COUNTRY_CODES
): MobileMoneyCountryCode {
  const code = preferred?.trim().toUpperCase();
  if (code && allowed.includes(code) && isMobileMoneyCountry(code)) {
    return code as MobileMoneyCountryCode;
  }
  const fallback = allowed.find((iso) => isMobileMoneyCountry(iso));
  return (fallback as MobileMoneyCountryCode | undefined) ?? 'CM';
}

export function mobileMoneyCallingCode(iso: string): string | null {
  const code = iso.trim().toUpperCase();
  if (!isMobileMoneyCountry(code)) return null;
  return CALLING_CODE_BY_ISO[code as MobileMoneyCountryCode];
}
