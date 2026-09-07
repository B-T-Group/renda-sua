import parsePhoneNumberFromString, { type CountryCode } from 'libphonenumber-js';
import { getDeviceDefaultCountryCode } from './deviceDefaultCountry';
import { nationalDigitsToE164 } from './phoneLoginUsername';

/** Aligné web (CM / GA pour Mobile Money). */
export const DEFAULT_MOBILE_MONEY_COUNTRY_CODES = ['CM', 'GA'] as const;

export type OrderPhoneValidateFail = { ok: false; reason: 'empty' | 'invalid' | 'unsupported' };

export type OrderPhoneValidateOk = { ok: true; e164: string };

export type OrderPhoneValidateResult = OrderPhoneValidateOk | OrderPhoneValidateFail;

export function pickMobileMoneyDefaultCountry(preferred?: string | null): CountryCode {
  const p = preferred?.trim().toUpperCase();
  if (p === 'CM' || p === 'GA') return p;
  const d = getDeviceDefaultCountryCode();
  return d === 'CM' || d === 'GA' ? d : 'CM';
}

export function validateOrderPaymentPhone(
  raw: string,
  supported: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES,
  defaultCountry?: CountryCode
): OrderPhoneValidateResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  const p = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!p?.isValid()) return { ok: false, reason: 'invalid' };
  const c = p.country;
  if (!c || !supported.includes(c)) return { ok: false, reason: 'unsupported' };
  return { ok: true, e164: p.format('E.164') };
}

export function validateOrderPaymentPhoneForCountry(
  countryIso: CountryCode,
  nationalDigits: string
): OrderPhoneValidateResult {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164) return { ok: false, reason: 'invalid' };
  return validateOrderPaymentPhone(e164);
}
