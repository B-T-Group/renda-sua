import { useMemo } from 'react';
import { useProfileMe } from '@/hooks/useProfileMe';

/** User-level referral code from GET /users/me. */
export function useReferralCode() {
  const { me, loading, error, refetch } = useProfileMe();
  const referralCode = useMemo(() => {
    const fromUser = me?.referral_code?.trim();
    if (fromUser) return fromUser;
    return me?.agent?.agent_code?.trim() || null;
  }, [me?.agent?.agent_code, me?.referral_code]);

  return {
    referralCode,
    internal: me?.internal === true,
    loading,
    error,
    refresh: refetch,
  };
}
