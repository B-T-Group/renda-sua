import { useCallback, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface CancellationFeeResponse {
  success: boolean;
  cancellationFee: number;
  currency: string;
  country: string;
  message: string;
}

export interface CancellationFeeError {
  success: false;
  error: string;
}

export const useCancellationFee = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  const getCancellationFee = useCallback(
    async (country: string): Promise<CancellationFeeResponse | null> => {
      if (!country) {
        setError('Country code is required');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<
          CancellationFeeResponse | CancellationFeeError
        >('/orders/cancellation-fee', {
          params: { country },
        });

        if (response.data.success) {
          return response.data as CancellationFeeResponse;
        } else {
          const errorData = response.data as CancellationFeeError;
          setError(errorData.error);
          return null;
        }
      } catch (err: unknown) {
        const errorMessage =
          (err as any)?.response?.data?.error ||
          (err as Error)?.message ||
          'Failed to fetch cancellation fee';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    getCancellationFee,
    loading,
    error,
    clearError,
  };
};
