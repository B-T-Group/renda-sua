import { useCallback, useEffect, useState } from 'react';
import { agentApi } from '@/services/agentApi';
import { businessReferralsApi } from '@/services/businessReferralsApi';
import type { ReferralProjectedPayout } from '@/types/referralProjectedPayout';

export function useReferralProjectedPayout(
  source: 'agent' | 'business',
  enabled = true
) {
  const [projection, setProjection] = useState<ReferralProjectedPayout | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const res =
        source === 'agent'
          ? await agentApi.agents.getReferralPayoutProjection()
          : await businessReferralsApi.getReferralPayoutProjection();
      setProjection(res?.success ? res : null);
    } catch {
      setProjection(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, source]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { projection, loading, refresh };
}
