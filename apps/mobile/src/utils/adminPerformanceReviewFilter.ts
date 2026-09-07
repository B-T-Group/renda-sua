import type {
  ReferredBusinessSummary,
  TopAgentEntry,
} from '../types/adminPerformance';

/** Businesses still needing payout review attention (not approved / paid). */
export function needsReferralReview(biz: ReferredBusinessSummary): boolean {
  if (biz.isPaid) return false;
  return biz.payoutReviewStatus !== 'approved';
}

/** Filter referred businesses; drop agents with nothing left to review. */
export function filterAgentsPendingReview(
  agents: TopAgentEntry[]
): TopAgentEntry[] {
  return agents
    .map((agent) => {
      const businesses = (agent.referredBusinesses ?? []).filter(
        needsReferralReview
      );
      return { ...agent, referredBusinesses: businesses };
    })
    .filter((agent) => (agent.referredBusinesses ?? []).length > 0);
}
