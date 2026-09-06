import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessAccountTypeId } from '../../types/business/accountType';
import {
  getPlanById,
  mergePlansWithCommissionRates,
} from '../../types/business/accountType';
import { businessApi } from '../../services/businessApi';

export function useBusinessAccountType(
  accountType?: string | null,
  lockedUntil?: string | null,
  onSuccess?: (newType: string) => void
) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState(mergePlansWithCommissionRates());
  const [countryCode, setCountryCode] = useState<string | null>(null);

  const currentType = (accountType as BusinessAccountTypeId | undefined) ?? 'STANDARD';
  const plan = useMemo(() => {
    return plans.find((p) => p.id === currentType) ?? getPlanById(currentType);
  }, [plans, currentType]);

  const isLocked = !!lockedUntil && new Date(lockedUntil) > new Date();
  const lockedUntilDate = lockedUntil ? new Date(lockedUntil) : null;
  const lockedUntilLabel = lockedUntilDate
    ? lockedUntilDate.toLocaleDateString()
    : null;

  const lockedMessage = isLocked
    ? t(
        'business.accountType.lockedMessage',
        'Your plan is committed until {{date}}. Plans are locked for 30 days after each change.',
        { date: lockedUntilLabel }
      )
    : null;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await businessApi.accountType.get();
        if (cancelled || !res.success) return;
        setCountryCode(res.data.countryCode ?? null);
        setPlans(mergePlansWithCommissionRates(res.data.plans));
      } catch {
        // Keep default CA rates as fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const changeAccountType = useCallback(
    async (newType: BusinessAccountTypeId) => {
      setLoading(true);
      setError(null);
      try {
        const res = await businessApi.accountType.change(newType);
        if (!res.success) {
          throw new Error(
            t('business.accountType.changeFailed', 'Failed to change plan')
          );
        }
        if (res.data?.plans) {
          setPlans(mergePlansWithCommissionRates(res.data.plans));
          setCountryCode(res.data.countryCode ?? null);
        }
        onSuccess?.(newType);
      } catch (err: any) {
        const serverMessage =
          err?.message ||
          t('business.accountType.changeFailed', 'Failed to change plan');
        setError(serverMessage);
        throw new Error(serverMessage);
      } finally {
        setLoading(false);
      }
    },
    [onSuccess, t]
  );

  return {
    currentType,
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
