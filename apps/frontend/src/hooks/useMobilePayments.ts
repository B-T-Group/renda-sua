import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface MobilePaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
  callbackUrl?: string;
  returnUrl?: string;
  provider?: 'mypvit' | 'airtel' | 'moov' | 'mtn';
  paymentMethod?: 'mobile_money' | 'card' | 'bank_transfer';
  agent?: string;
  product?: string;
  accountId?: string; // Account ID for top-up operations
}

export interface MobilePaymentResponse {
  success: boolean;
  data?: {
    transactionId: string;
    providerTransactionId?: string;
    paymentUrl?: string;
    message?: string;
    provider?: string;
  };
  message?: string;
  errorCode?: string;
}

export function useMobilePayments() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const apiClient = useApiClient();

  const initiatePayment = useCallback(
    async (request: MobilePaymentRequest): Promise<MobilePaymentResponse> => {
      setLoading(true);
      setError(null);
      setSuccess(null);

      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.post(
          '/mobile-payments/initiate',
          request
        );

        if (response.data.success) {
          setSuccess('Payment initiated successfully');
          return {
            success: true,
            data: response.data.data,
            message: response.data.message,
          };
        } else {
          const errorMessage =
            response.data.message || 'Payment initiation failed';
          setError(errorMessage);
          return {
            success: false,
            message: errorMessage,
            errorCode: response.data.errorCode,
          };
        }
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Payment initiation failed';
        setError(errorMessage);

        return {
          success: false,
          message: errorMessage,
          errorCode: err.response?.data?.errorCode,
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const checkTransactionStatus = useCallback(
    async (transactionId: string, provider?: string): Promise<any> => {
      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.get(
          `/mobile-payments/transactions/${transactionId}/status${
            provider ? `?provider=${provider}` : ''
          }`
        );

        return response.data;
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Failed to check transaction status';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [apiClient]
  );

  const clearMessages = useCallback(() => {
    setError(null);
    setSuccess(null);
  }, []);

  return {
    initiatePayment,
    checkTransactionStatus,
    loading,
    error,
    success,
    clearMessages,
  };
}
