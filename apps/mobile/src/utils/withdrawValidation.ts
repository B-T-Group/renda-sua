import type { CountryCode } from 'libphonenumber-js';
import { nationalDigitsToE164 } from './phoneLoginUsername';
import {
  DEFAULT_MOBILE_MONEY_COUNTRY_CODES,
  validateOrderPaymentPhone,
} from './placeOrderPhoneValidation';

/** Aligné web `WithdrawModal` (XAF min pour retrait Mobile Money). */
export const MIN_WITHDRAW_AMOUNT_XAF = 150;

/** Stripe Connect minimum payout (1.00 in the account's currency). */
export const MIN_WITHDRAW_AMOUNT_STRIPE = 1;

export function isWithdrawPhoneFormValid(
  countryIso: CountryCode,
  nationalDigits: string,
  supported: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES
): boolean {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164) return false;
  return validateOrderPaymentPhone(e164, supported).ok;
}

export function withdrawPhoneFormToE164(
  countryIso: CountryCode,
  nationalDigits: string,
  supported: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES
): string | null {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164 || !validateOrderPaymentPhone(e164, supported).ok) return null;
  return e164;
}
