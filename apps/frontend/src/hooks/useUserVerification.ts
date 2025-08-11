import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export const useUserVerification = () => {
  const apiClient = useApiClient();

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    if (!apiClient) throw new Error('API client not available');
    await apiClient.post('/users/resend_verification');
  }, [apiClient]);

  return { resendVerificationEmail };
};
