import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agentApi } from '../services/agentApi';

export function usePlaceOrderDiscountCode() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async () => {
    const code = draft.trim();
    if (!code) {
      setError(t('client.placeOrder.discountCode.empty', 'Enter a code'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await agentApi.orders.validateDiscountCode(code);
      if (!res.valid || !res.discountPercentage) {
        setAppliedCode(null);
        setPercentage(0);
        setError(res.message || t('client.placeOrder.discountCode.invalid', 'Invalid code'));
        return;
      }
      setAppliedCode(code);
      setPercentage(res.discountPercentage);
    } catch (e: unknown) {
      setAppliedCode(null);
      setPercentage(0);
      setError(e instanceof Error ? e.message : t('client.placeOrder.discountCode.invalid', 'Invalid code'));
    } finally {
      setLoading(false);
    }
  }, [draft, t]);

  const clear = useCallback(() => {
    setAppliedCode(null);
    setPercentage(0);
    setError(null);
    setDraft('');
  }, []);

  return { draft, setDraft, appliedCode, percentage, loading, error, apply, clear };
}
