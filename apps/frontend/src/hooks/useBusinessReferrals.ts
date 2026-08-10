import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface BusinessReferralsSummary {
  businessCode: string;
  referralAmount: number;
  currency: string;
  countryCode: string | null;
  minApprovedItems: number;
  referredCount: number;
  paidCount: number;
}

export function useBusinessReferrals(enabled = true) {
  const apiClient = useApiClient();
  const [summary, setSummary] = useState<BusinessReferralsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!apiClient || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        businessCode: string;
        referralAmount: number;
        currency: string;
        countryCode: string | null;
        minApprovedItems: number;
        referredCount: number;
        paidCount: number;
      }>('/businesses/me/referrals-summary');
      if (res.data.success) {
        setSummary({
          businessCode: res.data.businessCode,
          referralAmount: res.data.referralAmount,
          currency: res.data.currency,
          countryCode: res.data.countryCode,
          minApprovedItems: res.data.minApprovedItems,
          referredCount: res.data.referredCount,
          paidCount: res.data.paidCount,
        });
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load referrals');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { summary, loading, error, refresh };
}
