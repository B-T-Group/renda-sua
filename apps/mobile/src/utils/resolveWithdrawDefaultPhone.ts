import { e164ToCountryAndNational } from './phoneLoginUsername';
import { DEFAULT_MOBILE_MONEY_COUNTRY_CODES, isMobileMoneyCountry } from './placeOrderPhoneValidation';

function momoPhone(value: string | null | undefined, allowed: readonly string[]): string {
  const raw = value?.trim() || '';
  if (!raw) return '';
  return isMobileMoneyCountry(e164ToCountryAndNational(raw)?.countryIso, allowed) ? raw : '';
}

export function resolveWithdrawDefaultPhone(input: {
  isLocationAccount: boolean;
  locationPhone?: string | null;
  userPhone?: string | null;
  authPhone?: string | null;
  /** Mobile Money countries (from useMobileMoneyCountries); defaults to CM/GA/TG. */
  allowedIsos?: readonly string[];
}): string {
  const allowed = input.allowedIsos ?? DEFAULT_MOBILE_MONEY_COUNTRY_CODES;
  const location = momoPhone(input.locationPhone, allowed);
  const user = momoPhone(input.userPhone, allowed);
  const auth = momoPhone(input.authPhone, allowed);
  if (input.isLocationAccount) return location || user || auth;
  return user || auth;
}
