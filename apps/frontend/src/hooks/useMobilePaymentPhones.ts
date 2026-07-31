import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface MobilePaymentPhone {
  id: string;
  user_id: string;
  phone_e164: string;
  is_verified: boolean;
  verified_at: string | null;
  last_verification_transaction_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MobilePaymentPhoneStatus {
  phone: MobilePaymentPhone;
  pendingTransaction?: {
    id: string;
    status: string;
    reference: string;
  } | null;
}

export function parseE164Parts(phoneE164: string): {
  countryCode: string;
  phoneNumber: string;
} {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.startsWith('237')) {
    return { countryCode: '237', phoneNumber: digits.slice(3) };
  }
  if (digits.startsWith('241')) {
    return { countryCode: '241', phoneNumber: digits.slice(3) };
  }
  return { countryCode: '237', phoneNumber: digits };
}

export function useMobilePaymentPhones(autoFetch = true) {
  const apiClient = useApiClient();
  const [phones, setPhones] = useState<MobilePaymentPhone[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPhones = useCallback(async () => {
    if (!apiClient) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{ success: boolean; data: { phones: MobilePaymentPhone[] } }>(
        '/mobile-payment-phones'
      );
      setPhones(res.data?.data?.phones ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load mobile payment phones');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    if (autoFetch) void fetchPhones();
  }, [autoFetch, fetchPhones]);

  const createPhone = useCallback(
    async (countryCode: string, phoneNumber: string) => {
      if (!apiClient) throw new Error('API client not available');
      const res = await apiClient.post<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
        '/mobile-payment-phones',
        { countryCode, phoneNumber }
      );
      const phone = res.data.data.phone;
      setPhones((prev) => {
        const exists = prev.some((p) => p.id === phone.id);
        return exists ? prev.map((p) => (p.id === phone.id ? phone : p)) : [phone, ...prev];
      });
      return phone;
    },
    [apiClient]
  );

  const updatePhone = useCallback(
    async (id: string, countryCode: string, phoneNumber: string) => {
      if (!apiClient) throw new Error('API client not available');
      const res = await apiClient.patch<{ success: boolean; data: { phone: MobilePaymentPhone } }>(
        `/mobile-payment-phones/${id}`,
        { countryCode, phoneNumber }
      );
      const phone = res.data.data.phone;
      setPhones((prev) => prev.map((p) => (p.id === id ? phone : p)));
      return phone;
    },
    [apiClient]
  );

  const deletePhone = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('API client not available');
      await apiClient.delete(`/mobile-payment-phones/${id}`);
      setPhones((prev) => prev.filter((p) => p.id !== id));
    },
    [apiClient]
  );

  const startVerification = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('API client not available');
      const res = await apiClient.post<{
        success: boolean;
        data: { transactionId: string; message?: string };
      }>(`/mobile-payment-phones/${id}/verify`);
      return res.data.data;
    },
    [apiClient]
  );

  const getStatus = useCallback(
    async (id: string) => {
      if (!apiClient) throw new Error('API client not available');
      const res = await apiClient.get<{ success: boolean; data: MobilePaymentPhoneStatus }>(
        `/mobile-payment-phones/${id}`
      );
      const status = res.data.data;
      setPhones((prev) =>
        prev.map((p) => (p.id === id ? status.phone : p))
      );
      return status;
    },
    [apiClient]
  );

  const attachAgentPhone = useCallback(
    async (mobilePaymentPhoneId: string) => {
      if (!apiClient) throw new Error('API client not available');
      await apiClient.post('/mobile-payment-phones/agent/attach', {
        mobilePaymentPhoneId,
      });
    },
    [apiClient]
  );

  const pollUntilVerified = useCallback(
    async (id: string, timeoutMs = 120000, intervalMs = 3000) => {
      const started = Date.now();
      while (Date.now() - started < timeoutMs) {
        const status = await getStatus(id);
        if (status.phone.is_verified) return status.phone;
        if (status.pendingTransaction?.status === 'failed') {
          throw new Error('Verification payment failed');
        }
        await new Promise((r) => setTimeout(r, intervalMs));
      }
      throw new Error('Verification timed out');
    },
    [getStatus]
  );

  const hasVerifiedPhone = phones.some((p) => p.is_verified);

  return {
    phones,
    loading,
    error,
    hasVerifiedPhone,
    fetchPhones,
    createPhone,
    updatePhone,
    deletePhone,
    startVerification,
    getStatus,
    attachAgentPhone,
    pollUntilVerified,
  };
}

export function useMobilePaymentPhonePoll(onVerified?: () => void) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  return { stopPoll };
}
