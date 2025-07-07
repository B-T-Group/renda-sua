import { useState } from 'react';
import { useApiClient } from './useApiClient';

interface TopUpRequest {
  phoneNumber: string;
  amount: string;
  currency: string;
  payerMessage?: string;
  payeeNote?: string;
}

interface TopUpResponse {
  status: boolean;
  financialTransactionId?: string;
  externalId?: string;
  amount?: string;
  currency?: string;
  statusMessage?: string;
  error?: string;
}

export const useMtnMomoTopUp = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const apiClient = useApiClient();

  const requestTopUp = async (request: TopUpRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!apiClient) {
      setError('API client not available');
      setLoading(false);
      return false;
    }

    try {
      const response = await apiClient.post(
        '/mtn-momo/collection/request-to-pay',
        {
          amount: request.amount,
          currency: request.currency,
          externalId: `topup_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
          payer: {
            partyIdType: 'MSISDN',
            partyId: request.phoneNumber.replace(/\D/g, ''), // Remove non-digits
          },
          payerMessage:
            request.payerMessage ||
            `Top up request for ${request.currency} account`,
          payeeNote:
            request.payeeNote ||
            `Account top up of ${request.amount} ${request.currency}`,
        }
      );

      if (response.data.success) {
        setSuccess(
          `Payment request sent successfully! Transaction ID: ${response.data.data.financialTransactionId}`
        );
        return true;
      } else {
        setError(response.data.message || 'Failed to send payment request');
        return false;
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        'Failed to send payment request';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  return {
    requestTopUp,
    loading,
    error,
    success,
    clearMessages,
  };
};
