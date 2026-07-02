import { useState, useCallback } from 'react';
import { useApiClient } from './useApiClient';

export interface TwilioStartResponse {
  account_sid: string;
  service_sid: string;
  sid: string;
  status: string;
  to: string;
  valid: boolean;
  channel: string;
  date_created: string;
  date_updated: string;
}

export interface TwilioVerifyResponse {
  account_sid: string;
  service_sid: string;
  sid: string;
  status: string;
  to: string;
  valid: boolean;
  channel: string;
  date_created: string;
  date_updated: string;
}

interface UseTwilioVerifyState {
  startVerification: (phoneNumber: string, channel?: 'sms' | 'call') => Promise<TwilioStartResponse>;
  verifyCode: (phoneNumber: string, code: string) => Promise<TwilioVerifyResponse>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

export function useTwilioVerify(): UseTwilioVerifyState {
  const apiClient = useApiClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startVerification = useCallback(
    async (phoneNumber: string, channel: 'sms' | 'call' = 'sms'): Promise<TwilioStartResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{ success: boolean; data: TwilioStartResponse }>(
          '/twilio-verify/start',
          {
            phone_number: phoneNumber,
            channel,
          }
        );
        return response.data.data;
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to start verification';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const verifyCode = useCallback(
    async (phoneNumber: string, code: string): Promise<TwilioVerifyResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post<{ success: boolean; data: TwilioVerifyResponse }>(
          '/twilio-verify/verify',
          {
            phone_number: phoneNumber,
            code,
          }
        );
        return response.data.data;
      } catch (err: any) {
        const errorMessage = err.response?.data?.error || err.message || 'Failed to verify code';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [apiClient]
  );

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return {
    startVerification,
    verifyCode,
    loading,
    error,
    reset,
  };
}
