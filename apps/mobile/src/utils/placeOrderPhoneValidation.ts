import parsePhoneNumberFromString, { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { getDeviceDefaultCountryCode } from './deviceDefaultCountry';
import { nationalDigitsToE164 } from './phoneLoginUsername';

/**
 * Countries whose +codes the backend can route to a Mobile Money provider
 * (mirrors backend `mobile-payment-phones/phone-e164.util.ts`):
 * CM → Freemopay, GA → MyPVit, TG → FedaPay (moov_tg / togocel by prefix).
 * Used as the fallback before/if the backend country list can't be loaded;
 * screens should prefer `useMobileMoneyCountries()`.
 */
export const DEFAULT_MOBILE_MONEY_COUNTRY_CODES = ['CM', 'GA', 'TG'] as const satisfies readonly CountryCode[];

const CALLING_TO_ISO: Record<string, CountryCode> = { '237': 'CM', '241': 'GA', '228': 'TG' };

/** Minimal shape of a backend supported-country row (see supportedCountriesApi). */
export type MobileMoneyCountrySource = {
  code?: string | null;
  serviceStatus?: string | null;
  supportedPaymentMethods?: string[] | null;
};

/**
 * Mobile Money countries from the backend's per-country list: the
 * MoMo-routable countries that the backend reports as active, plus any that
 * have a non-card payment system configured. Falls back to the static list
 * when the backend list is empty (loading / offline / error).
 */
export function resolveMobileMoneyCountries(
  countries: readonly MobileMoneyCountrySource[] | null | undefined
): CountryCode[] {
  const capable = DEFAULT_MOBILE_MONEY_COUNTRY_CODES as readonly string[];
  if (!countries || countries.length === 0) return [...DEFAULT_MOBILE_MONEY_COUNTRY_CODES];
  const out = new Set<string>();
  for (const c of countries) {
    const code = c.code?.trim().toUpperCase();
    if (!code || !capable.includes(code)) continue;
    const active = (c.serviceStatus ?? 'active').toLowerCase() === 'active';
    const hasMoMo = (c.supportedPaymentMethods ?? []).some((m) => m !== 'stripe');
    if (active || hasMoMo) out.add(code);
  }
  // Keep a stable, known order (CM, GA, TG).
  return DEFAULT_MOBILE_MONEY_COUNTRY_CODES.filter((c) => out.has(c));
}

export function isMobileMoneyCountry(
  iso: string | null | undefined,
  allowed: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES
): iso is CountryCode {
  const c = iso?.trim().toUpperCase();
  return !!c && allowed.includes(c);
}

/** ISO for a Mobile Money calling code ('237' → 'CM'), or null. */
export function mobileMoneyIsoFromCallingCode(callingCode: string | null | undefined): CountryCode | null {
  return CALLING_TO_ISO[(callingCode ?? '').replace(/\D/g, '')] ?? null;
}

/** Calling code without '+' for a Mobile Money ISO ('TG' → '228'). */
export function mobileMoneyCallingCode(iso: CountryCode): string {
  return getCountryCallingCode(iso);
}

export type OrderPhoneValidateFail = { ok: false; reason: 'empty' | 'invalid' | 'unsupported' };

export type OrderPhoneValidateOk = { ok: true; e164: string };

export type OrderPhoneValidateResult = OrderPhoneValidateOk | OrderPhoneValidateFail;

export function pickMobileMoneyDefaultCountry(
  preferred?: string | null,
  allowed: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES
): CountryCode {
  const p = preferred?.trim().toUpperCase();
  if (isMobileMoneyCountry(p, allowed)) return p;
  const d = getDeviceDefaultCountryCode();
  if (isMobileMoneyCountry(d, allowed)) return d;
  return (allowed[0] as CountryCode | undefined) ?? 'CM';
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
  nationalDigits: string,
  supported: readonly string[] = DEFAULT_MOBILE_MONEY_COUNTRY_CODES
): OrderPhoneValidateResult {
  const e164 = nationalDigitsToE164(countryIso, nationalDigits);
  if (!e164) return { ok: false, reason: 'invalid' };
  return validateOrderPaymentPhone(e164, supported);
}
