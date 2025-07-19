import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface AirtelMoneyCollectionRequest {
  reference: string;
  subscriber: {
    country: string;
    currency: string;
    msisdn: string;
  };
  transaction: {
    amount: string;
    country: string;
    currency: string;
    id: string;
  };
}

export interface AirtelMoneyResponse {
  status: boolean;
  transactionId?: string;
  reference?: string;
  amount?: string;
  currency?: string;
  statusCode?: string;
  statusMessage?: string;
  error?: string;
}

export interface AirtelMoneyBalanceResponse {
  status: boolean;
  data?: {
    balance: string;
    currency: string;
  };
  error?: string;
}

export function useAirtelMoney() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const requestPayment = useCallback(
    async (
      request: AirtelMoneyCollectionRequest
    ): Promise<AirtelMoneyResponse> => {
      setLoading(true);
      setError(null);

      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.post(
          '/airtel-money/request-payment',
          request
        );

        return {
          status: true,
          transactionId: response.data.data.transactionId,
          reference: response.data.data.reference,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          statusMessage: response.data.data.statusMessage,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Payment request failed';
        setError(errorMessage);

        return {
          status: false,
          error: errorMessage,
          statusCode: err.response?.status?.toString(),
          statusMessage: 'Payment request failed',
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const getTransactionStatus = useCallback(
    async (transactionId: string): Promise<AirtelMoneyResponse> => {
      setLoading(true);
      setError(null);

      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.get(
          `/airtel-money/transaction/${transactionId}/status`
        );

        return {
          status: true,
          transactionId: response.data.data.transactionId,
          reference: response.data.data.reference,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          statusCode: response.data.data.statusCode,
          statusMessage: response.data.data.statusMessage,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Failed to get transaction status';
        setError(errorMessage);

        return {
          status: false,
          error: errorMessage,
          statusCode: err.response?.status?.toString(),
          statusMessage: 'Failed to get transaction status',
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const refundTransaction = useCallback(
    async (
      transactionId: string,
      amount: string,
      reason?: string
    ): Promise<AirtelMoneyResponse> => {
      setLoading(true);
      setError(null);

      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.post(
          `/airtel-money/refund/${transactionId}`,
          {
            amount,
            reason,
          }
        );

        return {
          status: true,
          transactionId: response.data.data.transactionId,
          reference: response.data.data.reference,
          amount: response.data.data.amount,
          currency: response.data.data.currency,
          statusMessage: response.data.data.statusMessage,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message || err.message || 'Refund failed';
        setError(errorMessage);

        return {
          status: false,
          error: errorMessage,
          statusCode: err.response?.status?.toString(),
          statusMessage: 'Refund failed',
        };
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const getAccountBalance =
    useCallback(async (): Promise<AirtelMoneyBalanceResponse> => {
      setLoading(true);
      setError(null);

      try {
        if (!apiClient) throw new Error('API client not available');

        const response = await apiClient.get('/airtel-money/balance');

        return {
          status: true,
          data: response.data.data,
        };
      } catch (err: any) {
        const errorMessage =
          err.response?.data?.message ||
          err.message ||
          'Failed to get account balance';
        setError(errorMessage);

        return {
          status: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    }, [apiClient]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    requestPayment,
    getTransactionStatus,
    refundTransaction,
    getAccountBalance,
    clearError,
  };
}
