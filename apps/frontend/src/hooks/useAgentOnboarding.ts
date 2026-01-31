import { useState, useCallback } from 'react';
import { useApiClient } from './useApiClient';

interface CompleteOnboardingResponse {
  success: boolean;
  agent?: {
    id: string;
    onboarding_complete: boolean;
    updated_at: string;
  };
  message?: string;
  error?: string;
}

/**
 * Hook for managing agent onboarding API calls
 */
export const useAgentOnboarding = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiClient = useApiClient();

  /**
   * Mark the agent's onboarding as complete
   */
  const completeOnboarding = useCallback(async (): Promise<boolean> => {
    if (!apiClient) {
      setError('API client not available');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<CompleteOnboardingResponse>(
        '/agents/complete_onboarding'
      );

      if (response.data.success) {
        return true;
      } else {
        setError(response.data.error || 'Failed to complete onboarding');
        return false;
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } }; message?: string };
      setError(
        error.response?.data?.error || error.message || 'Failed to complete onboarding'
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  return {
    completeOnboarding,
    loading,
    error,
  };
};
