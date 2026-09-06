import { useCallback, useEffect, useState } from 'react';
import { mobilePaymentPhonesApi } from '../services/mobilePaymentPhonesApi';
import type {
  MobileMoneyVerificationMethod,
  MobilePaymentPhone,
} from '../types/mobilePaymentPhone';

export function useMobilePaymentPhones(autoFetch = true) {
  const [phones, setPhones] = useState<MobilePaymentPhone[]>([]);
  const [verificationMethod, setVerificationMethod] =
    useState<MobileMoneyVerificationMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhones = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await mobilePaymentPhonesApi.list();
      setPhones(res.data?.phones ?? []);
      const method = res.data?.verificationMethod;
      setVerificationMethod(
        method === 'transaction' || method === 'question' ? method : 'question'
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load phones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) void fetchPhones();
  }, [autoFetch, fetchPhones]);

  const pollUntilVerified = useCallback(async (id: string) => {
    const started = Date.now();
    while (Date.now() - started < 120000) {
      const res = await mobilePaymentPhonesApi.getStatus(id);
      const status = res.data;
      setPhones((prev) => prev.map((p) => (p.id === id ? status.phone : p)));
      if (status.phone.is_verified) return status.phone;
      if (status.pendingTransaction?.status === 'failed') {
        throw new Error('Verification payment failed');
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error('Verification timed out');
  }, []);

  const hasVerifiedPhone = phones.some((p) => p.is_verified);

  const deletePhone = useCallback(async (id: string) => {
    await mobilePaymentPhonesApi.delete(id);
    setPhones((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return {
    phones,
    verificationMethod,
    loading,
    error,
    hasVerifiedPhone,
    fetchPhones,
    pollUntilVerified,
    deletePhone,
    api: mobilePaymentPhonesApi,
  };
}
