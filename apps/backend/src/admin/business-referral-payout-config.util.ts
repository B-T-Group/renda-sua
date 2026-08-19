/**
 * Config key for business-referral commission amount.
 * Internal employees and non-internal agents share the higher XAF rate;
 * referrers with no agent persona use the B2B rate.
 */
export type BusinessReferralPayoutTier = 'internal' | 'standard' | 'b2b';

export function businessReferralPayoutTier(params: {
  isInternal: boolean;
  hasAgentPersona: boolean;
}): BusinessReferralPayoutTier {
  if (params.isInternal) return 'internal';
  if (!params.hasAgentPersona) return 'b2b';
  return 'standard';
}

export function businessReferralPayoutConfigKey(
  tier: BusinessReferralPayoutTier
): string {
  if (tier === 'internal') return 'business_referral_payout_amount_internal';
  if (tier === 'b2b') return 'business_to_business_referral_amount';
  return 'business_referral_payout_amount';
}

export function businessReferralPayoutConfigKeyFromUser(row?: {
  internal?: boolean | null;
  agent?: { id?: string } | null;
} | null): string {
  return businessReferralPayoutConfigKey(
    businessReferralPayoutTier({
      isInternal: row?.internal === true,
      hasAgentPersona: Boolean(row?.agent?.id),
    })
  );
}
