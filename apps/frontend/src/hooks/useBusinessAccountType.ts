import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useApiClient } from './useApiClient';
import {
  getPlanById,
  mergePlansWithCommissionRates,
  type BusinessAccountTypeId,
  type BusinessAccountTypePlan,
} from '../constants/businessAccountTypes';

type AccountTypeApiData = {
  accountType: string;
  commissionPercentage: number;
  lockedUntil: string | null;
  countryCode: string | null;
  plans: Array<{ id: string; commissionPercent: number }>;
};

export function useBusinessAccountType() {
  const { t } = useTranslation();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<BusinessAccountTypePlan[]>(
    mergePlansWithCommissionRates()
  );
  const [countryCode, setCountryCode] = useState<string | null>(null);

  const accountType =
    (profile?.business?.account_type as BusinessAccountTypeId | undefined) ??
    'STANDARD';
  const lockedUntil = profile?.business?.account_type_locked_until ?? null;
  const plan = useMemo(() => {
    return plans.find((p) => p.id === accountType) ?? getPlanById(accountType);
  }, [plans, accountType]);

  const isLocked =
    !!lockedUntil && new Date(lockedUntil) > new Date();

  const lockedUntilDate = lockedUntil ? new Date(lockedUntil) : null;
  const lockedUntilLabel = lockedUntilDate
    ? lockedUntilDate.toLocaleDateString()
    : null;

  const lockedMessage = isLocked
    ? t(
        'business.accountType.lockedMessage',
        `Your plan is committed until ${lockedUntilLabel}. Plans are locked for 30 days after each change.`,
        { date: lockedUntilLabel }
      )
    : null;

  useEffect(() => {
    if (!apiClient) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient.get<{
          success: boolean;
          data: AccountTypeApiData;
        }>('/business-items/business/account-type');
        if (cancelled || !res.data.success) return;
        setCountryCode(res.data.data.countryCode ?? null);
        setPlans(mergePlansWithCommissionRates(res.data.data.plans));
      } catch {
        // Keep default CA rates as fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const changeAccountType = useCallback(
    async (newType: BusinessAccountTypeId) => {
      if (!apiClient) return;
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.patch<{
          success: boolean;
          data: AccountTypeApiData;
        }>('/business-items/business/account-type', {
          accountType: newType,
        });
        if (res.data.success && res.data.data?.plans) {
          setPlans(mergePlansWithCommissionRates(res.data.data.plans));
          setCountryCode(res.data.data.countryCode ?? null);
        }
        await refetchProfile();
      } catch (err: any) {
        const serverMessage =
          err?.response?.data?.message ||
          err?.message ||
          t('business.accountType.changeFailed', 'Failed to change plan');
        setError(serverMessage);
        throw new Error(serverMessage);
      } finally {
        setLoading(false);
      }
    },
    [apiClient, refetchProfile, t]
  );

  return {
    accountType,
    plan,
    plans,
    countryCode,
    isLocked,
    lockedUntil,
    lockedUntilLabel,
    lockedMessage,
    loading,
    error,
    changeAccountType,
  };
}
