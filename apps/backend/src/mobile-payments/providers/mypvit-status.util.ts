import { removeCountryCode } from '../phone-validation.util';

export type MypvitOperator = 'moov' | 'airtel';

const MOOV_NATIONAL_PREFIXES = ['62', '65', '66'] as const;

/**
 * MyPVit stores customer phones as E.164. Operator prefixes are national
 * (Gabon MOOV 62/65/66, Airtel 74/77). Strip the country code first.
 */
export function resolveMypvitOperator(phoneNumber?: string): MypvitOperator {
  if (!phoneNumber?.trim()) {
    return 'airtel';
  }
  const national = removeCountryCode(phoneNumber).replace(/^0+/, '');
  const prefix = national.slice(0, 2);
  if ((MOOV_NATIONAL_PREFIXES as readonly string[]).includes(prefix)) {
    return 'moov';
  }
  return 'airtel';
}

/** Original Status API: GET `/{code}/status/{transactionId}`. */
export function buildMypvitStatusPath(
  statusEndpointCode: string,
  transactionId: string
): string {
  return `/${statusEndpointCode}/status/${encodeURIComponent(transactionId)}`;
}

export function isNotFoundHttpError(error: { response?: { status?: number } }): boolean {
  return error?.response?.status === 404;
}
