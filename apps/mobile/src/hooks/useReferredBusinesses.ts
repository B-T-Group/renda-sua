import { useCallback, useEffect, useState } from 'react';
import {
  referralsApi,
  type UserReferralsSummary,
} from '@/services/referralsApi';
import type { ReferredBusinessFollowUp } from '@/types/referredBusiness';

export function useReferredBusinesses(enabled = true, includeList = false) {
  const [summary, setSummary] = useState<UserReferralsSummary | null>(null);
  const [businesses, setBusinesses] = useState<ReferredBusinessFollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const summaryRes = await referralsApi.getSummary();
      if (summaryRes?.success) {
        setSummary(summaryRes);
      } else {
        setSummary(null);
      }
      if (includeList) {
        const listRes = await referralsApi.listReferredBusinesses();
        if (!listRes?.success) {
          throw new Error('Failed to load referred businesses');
        }
        setBusinesses(listRes.businesses ?? []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load referrals');
      if (!includeList) {
        setSummary(null);
        setBusinesses([]);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled, includeList]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const count =
    summary?.referredBusinessCount ?? summary?.referredCount ?? null;
  const referralCode =
    summary?.referralCode ?? summary?.agentCode ?? summary?.businessCode ?? null;

  return {
    summary,
    businesses,
    count,
    referralCode,
    loading,
    error,
    refresh,
    refetch: refresh,
  };
}
