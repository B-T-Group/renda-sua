import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUserProfileContext } from '../contexts/UserProfileContext';
import { useApiClient } from './useApiClient';
import {
  getPlanById,
  type BusinessAccountTypeId,
} from '../constants/businessAccountTypes';

export function useBusinessAccountType() {
  const { t } = useTranslation();
  const { profile, refetch: refetchProfile } = useUserProfileContext();
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accountType =
    (profile?.business?.account_type as BusinessAccountTypeId | undefined) ??
    'STANDARD';
  const lockedUntil = profile?.business?.account_type_locked_until ?? null;
  const plan = getPlanById(accountType);

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

  const changeAccountType = useCallback(
    async (newType: BusinessAccountTypeId) => {
      if (!apiClient) return;
      setLoading(true);
      setError(null);
      try {
        await apiClient.patch('/business-items/business/account-type', {
          accountType: newType,
        });
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
    isLocked,
    lockedUntil,
    lockedUntilLabel,
    lockedMessage,
    loading,
    error,
    changeAccountType,
  };
}
