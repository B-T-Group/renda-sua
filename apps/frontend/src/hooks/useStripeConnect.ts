import { useCallback, useEffect, useState } from 'react';
import { useApiClient } from './useApiClient';

export interface StripeConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  status: string;
}

export function useStripeConnect() {
  const apiClient = useApiClient();
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/stripe-connect/status');
      setStatus(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const startOnboarding = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/stripe-connect/account-link', {});
      const url = response.data.data?.url;
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to start Stripe onboarding'
      );
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  const openDashboard = useCallback(async (): Promise<void> => {
    try {
      const response = await apiClient.post('/stripe-connect/login-link', {});
      const url = response.data.data?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message);
    }
  }, [apiClient]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  return { status, loading, error, fetchStatus, startOnboarding, openDashboard };
}
