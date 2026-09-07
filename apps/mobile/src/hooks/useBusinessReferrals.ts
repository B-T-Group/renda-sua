import { useMemo } from 'react';
import { useReferredBusinesses } from './useReferredBusinesses';
import type { BusinessReferralsSummary } from '@/services/businessReferralsApi';

/** @deprecated Prefer useReferredBusinesses — kept for business screens during migration. */
export function useBusinessReferrals(enabled = true, includeList = false) {
  const { summary, businesses, loading, error, refresh } = useReferredBusinesses(
    enabled,
    includeList
  );

  const mappedSummary = useMemo<BusinessReferralsSummary | null>(() => {
    if (!summary) return null;
    const code =
      summary.referralCode || summary.businessCode || summary.agentCode || '';
    return {
      success: summary.success,
      businessCode: code,
      referralAmount: summary.referralAmount,
      currency: summary.currency,
      countryCode: summary.countryCode,
      minApprovedItems: summary.minApprovedItems,
      referredCount: summary.referredCount ?? summary.referredBusinessCount ?? 0,
      paidCount: summary.paidCount,
    };
  }, [summary]);

  return { summary: mappedSummary, businesses, loading, error, refresh };
}
