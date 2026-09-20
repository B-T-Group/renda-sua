import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/services/apiClient';
import type {
  PaymentProgramsMeResponse,
  PurchaseCreditGrant,
} from '@/types/purchaseCredits';
import {
  isCampaignPurchaseCredit,
  isUsablePurchaseCredit,
  summarizeUsableCredits,
} from '@/utils/purchaseCredits';

export function usePurchaseCredits(enabled = true) {
  const [grants, setGrants] = useState<PurchaseCreditGrant[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setGrants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PaymentProgramsMeResponse>('/payment-programs/me');
      setGrants(data?.grants ?? []);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to load purchase credits';
      setError(message);
      setGrants([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const usable = useMemo(
    () => grants.filter(isUsablePurchaseCredit),
    [grants]
  );
  const campaignGrants = useMemo(
    () => grants.filter(isCampaignPurchaseCredit),
    [grants]
  );
  const summary = useMemo(() => summarizeUsableCredits(grants), [grants]);

  return {
    grants,
    usable,
    campaignGrants,
    summary,
    loading,
    error,
    refresh,
  };
}
