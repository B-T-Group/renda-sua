import { useReferredBusinesses } from './useReferredBusinesses';

/** @deprecated Prefer useReferredBusinesses — kept for agent screens during migration. */
export function useAgentReferredBusinesses(enabled = true, includeList = false) {
  const {
    count,
    referralCode,
    businesses,
    loading,
    error,
    refetch,
  } = useReferredBusinesses(enabled, includeList);

  return {
    count,
    agentCode: referralCode,
    businesses,
    loading,
    error,
    refetch,
  };
}
