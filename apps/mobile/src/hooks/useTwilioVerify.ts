import { useState, useCallback } from 'react';
import { agentApi } from '../services/agentApi';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startVerification = useCallback(
    async (phoneNumber: string, channel: 'sms' | 'call' = 'sms'): Promise<TwilioStartResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await agentApi.users.startPhoneVerification({
          phone_number: phoneNumber,
        });
        return response.data;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to start verification';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const verifyCode = useCallback(
    async (phoneNumber: string, code: string): Promise<TwilioVerifyResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await agentApi.users.verifyPhoneCode({
          phone_number: phoneNumber,
          code,
        });
        return response.data;
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to verify code';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
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
