/** True when a MoMo-rail merchant must confirm their location payout number before accepting. */
export function orderNeedsMmPhoneBeforeConfirm(
  order: {
    business_location?: {
      mobile_payment_phone?: { is_verified?: boolean } | null;
    } | null;
  },
  isStripeRail: boolean
): boolean {
  if (isStripeRail) return false;
  return order.business_location?.mobile_payment_phone?.is_verified !== true;
}

export const MOBILE_MONEY_PHONE_UNCONFIRMED = 'MOBILE_MONEY_PHONE_UNCONFIRMED';

export function isMmPhoneUnconfirmedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: string }).code;
  if (code === MOBILE_MONEY_PHONE_UNCONFIRMED) return true;
  const message = (error as { message?: string }).message ?? '';
  return message.includes(MOBILE_MONEY_PHONE_UNCONFIRMED);
}
