import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export type StripePaymentEntity =
  | 'order'
  | 'account'
  | 'claim_order'
  | 'rental_booking'
  | 'order_cash_reconciliation';

export interface StripePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  accountId?: string;
  paymentEntity?: StripePaymentEntity;
  entityId?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface StripePaymentResponse {
  success: boolean;
  data?: {
    transactionId: string;
    reference: string;
    sessionId: string;
    paymentUrl?: string;
  };
  message?: string;
}

export interface StripeTransactionStatus {
  transactionId: string;
  reference: string;
  status:
    | 'pending'
    | 'authorized'
    | 'capture_pending'
    | 'success'
    | 'failed'
    | 'cancelled'
    | 'expired';
}

export function useStripePayments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const initiatePayment = useCallback(
    async (request: StripePaymentRequest): Promise<StripePaymentResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          '/stripe-payments/initiate',
          request
        );
        return { success: true, data: response.data.data };
      } catch (err: any) {
        const message =
          err.response?.data?.message ||
          err.message ||
          'Failed to start Stripe checkout';
        setError(message);
        return { success: false, message };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const checkStatus = useCallback(
    async (transactionId: string): Promise<StripeTransactionStatus | null> => {
      try {
        const response = await apiClient.get(
          `/stripe-payments/transactions/${transactionId}/status`
        );
        return response.data.data;
      } catch (err: any) {
        setError(err.response?.data?.message || err.message);
        return null;
      }
    },
    [apiClient]
  );

  const checkStatusByReference = useCallback(
    async (reference: string): Promise<StripeTransactionStatus | null> => {
      try {
        const response = await apiClient.get(
          `/stripe-payments/transactions/reference/${reference}`
        );
        const tx = response.data.data;
        return {
          transactionId: tx.id,
          reference: tx.reference,
          status: tx.status,
        };
      } catch (err: any) {
        setError(err.response?.data?.message || err.message);
        return null;
      }
    },
    [apiClient]
  );

  const withdraw = useCallback(
    async (params: {
      amount: number;
      currency: string;
      accountId: string;
      description?: string;
    }): Promise<{ success: boolean; message?: string }> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post('/stripe-payments/withdraw', params);
        return { success: !!response.data.success };
      } catch (err: any) {
        const message =
          err.response?.data?.message || err.message || 'Withdrawal failed';
        setError(message);
        return { success: false, message };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { initiatePayment, checkStatus, checkStatusByReference, withdraw, loading, error };
}
