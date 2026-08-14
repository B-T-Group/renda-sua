/**
 * Config key for business-referral commission amount.
 * Internal Rendasua employees earn a higher per-referral payout.
 */
export function businessReferralPayoutConfigKey(isInternal: boolean): string {
  return isInternal
    ? 'business_referral_payout_amount_internal'
    : 'business_referral_payout_amount';
}
