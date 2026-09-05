import * as libphonenumber from 'google-libphonenumber';

type CameroonCarrier = 'mtn' | 'orange';

interface CameroonPhoneResult {
  carrier: CameroonCarrier;
  phone: string;
}

const MTN_PREFIXES = new Set([
  '650', '651', '652', '653', '654',
  '670', '671', '672', '673', '674',
  '675', '676', '677', '678', '679',
  '680', '681', '682', '683', '684', '685', '686', '687', '688', '689',
]);

const ORANGE_PREFIXES = new Set([
  '655', '656', '657', '658', '659',
  '690', '691', '692', '693', '694', '695', '696', '697', '698', '699',
]);

export function isInternationalPhone(phone: string): boolean {
  const trimmed = phone.trim();
  return trimmed.startsWith('+') || trimmed.startsWith('00');
}

function normalizeCameroonPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('237')) {
    digits = digits.slice(3);
  }
  if (digits.length !== 9 || !digits.startsWith('6')) {
    return null;
  }
  return digits;
}

export function detectCameroonPhone(phone: string): CameroonPhoneResult | null {
  const normalized = normalizeCameroonPhone(phone);
  if (!normalized) return null;
  const prefix = normalized.slice(0, 3);
  if (MTN_PREFIXES.has(prefix)) {
    return { carrier: 'mtn', phone: normalized };
  }
  if (ORANGE_PREFIXES.has(prefix)) {
    return { carrier: 'orange', phone: normalized };
  }
  return null;
}

export function removeCountryCode(
  phoneNumber: string,
  defaultRegion = 'GA'
): string {
  if (!phoneNumber) return '';
  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const region = isInternationalPhone(phoneNumber) ? undefined : defaultRegion;
    const parsedNumber = phoneUtil.parse(phoneNumber, region);
    const nationalNumber = parsedNumber.getNationalNumber();
    return nationalNumber ? nationalNumber.toString() : phoneNumber;
  } catch {
    return phoneNumber;
  }
}

export interface PhoneValidationResult {
  isValid: boolean;
  isPossible: boolean;
  countryCode: string;
  nationalNumber: string;
  regionCode: string;
}

const EMPTY_VALIDATION: PhoneValidationResult = {
  isValid: false,
  isPossible: false,
  countryCode: '',
  nationalNumber: '',
  regionCode: '',
};

export function validatePhoneNumber(
  phoneNumber: string,
  defaultRegion = 'GA'
): PhoneValidationResult {
  if (!phoneNumber) return EMPTY_VALIDATION;
  try {
    const phoneUtil = libphonenumber.PhoneNumberUtil.getInstance();
    const region = isInternationalPhone(phoneNumber) ? undefined : defaultRegion;
    const parsedNumber = phoneUtil.parse(phoneNumber, region);
    return {
      isValid: phoneUtil.isValidNumber(parsedNumber),
      isPossible: phoneUtil.isPossibleNumber(parsedNumber),
      countryCode: parsedNumber.getCountryCode()?.toString() || '',
      nationalNumber: parsedNumber.getNationalNumber()?.toString() || '',
      regionCode: phoneUtil.getRegionCodeForNumber(parsedNumber) || '',
    };
  } catch {
    return EMPTY_VALIDATION;
  }
}

/** Wallet/top-up region when there is no catalog item. */
export function resolveWalletPhoneRegion(params: {
  phone?: string;
  userCountry?: string | null;
  addressCountry?: string | null;
}): string {
  const user = params.userCountry?.trim().toUpperCase();
  if (user) return user;
  const address = params.addressCountry?.trim().toUpperCase();
  if (address) return address;
  if (params.phone && detectCameroonPhone(params.phone)) return 'CM';
  return 'GA';
}
