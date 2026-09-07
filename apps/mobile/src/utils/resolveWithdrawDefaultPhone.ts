import { e164ToCountryAndNational } from './phoneLoginUsername';

function cmGaPhone(value?: string | null): string {
  const raw = value?.trim() || '';
  if (!raw) return '';
  const parsed = e164ToCountryAndNational(raw);
  if (parsed?.countryIso === 'CM' || parsed?.countryIso === 'GA') return raw;
  return '';
}

export function resolveWithdrawDefaultPhone(input: {
  isLocationAccount: boolean;
  locationPhone?: string | null;
  userPhone?: string | null;
  authPhone?: string | null;
}): string {
  const location = cmGaPhone(input.locationPhone);
  const user = cmGaPhone(input.userPhone);
  const auth = cmGaPhone(input.authPhone);
  if (input.isLocationAccount) return location || user || auth;
  return user || auth;
}
