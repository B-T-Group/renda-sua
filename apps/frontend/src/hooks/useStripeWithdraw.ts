import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface StripeWithdrawRequest {
  amount: number;
  currency: string;
  accountId: string;
  description?: string;
}

export interface StripeWithdrawResponse {
  success: boolean;
  data?: {
    transactionId: string;
    transferId?: string;
    message?: string;
  };
  message?: string;
  errorCode?: string;
}

export function useStripeWithdraw() {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useCallback(
    async (request: StripeWithdrawRequest): Promise<StripeWithdrawResponse> => {
      setLoading(true);
      setError(null);
      try {
        if (!apiClient) throw new Error('API client not available');
        const response = await apiClient.post(
          '/stripe-payments/withdraw',
          request
        );
        return {
          success: !!response.data?.success,
          data: response.data?.data,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Failed to process withdrawal';
        setError(errorMessage);
        return {
          success: false,
          message: errorMessage,
          errorCode: err.response?.data?.error,
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  return { withdraw, loading, error };
}
