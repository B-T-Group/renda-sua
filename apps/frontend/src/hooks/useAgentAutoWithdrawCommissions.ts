import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

/**
 * Loads and updates the agent's opt-in for automatic commission mobile payout.
 */
export function useAgentAutoWithdrawCommissions(enabled: boolean) {
  const apiClient = useApiClient();
  const [autoWithdrawCommissions, setAutoWithdrawCommissions] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchPreference = useCallback(async () => {
    if (!enabled || !apiClient) return;
    setLoading(true);
    try {
      const res = await apiClient.get<{
        success: boolean;
        data?: { auto_withdraw_commissions: boolean };
      }>('/agents/me/auto-withdraw-commissions');
      if (res.data.success && res.data.data) {
        setAutoWithdrawCommissions(res.data.data.auto_withdraw_commissions);
      }
    } finally {
      setLoading(false);
    }
  }, [apiClient, enabled]);

  useEffect(() => {
    if (!enabled) {
      setAutoWithdrawCommissions(false);
      setLoading(false);
      return;
    }
    void fetchPreference();
  }, [enabled, fetchPreference]);

  const setAutoWithdraw = useCallback(
    async (next: boolean): Promise<boolean> => {
      if (!enabled || !apiClient) return false;
      setLoading(true);
      try {
        await apiClient.patch('/agents/me/auto-withdraw-commissions', {
          auto_withdraw_commissions: next,
        });
        setAutoWithdrawCommissions(next);
        return true;
      } catch {
        return false;
      } finally {
        setLoading(false);
      }
    },
    [apiClient, enabled]
  );

  return {
    autoWithdrawCommissions,
    loading,
    setAutoWithdraw,
    refetch: fetchPreference,
  };
}
