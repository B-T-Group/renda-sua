import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from './useApiClient';
import { mapAuthGateApiError } from '../utils/authGateErrors';
import { msUntil } from '../utils/authGateTiming';
import type { OtpChannelChoice } from '../components/auth/OtpChannelPicker';

export type AuthGateFlowState = {
  flowId: string;
  channel: OtpChannelChoice;
  maskedEmail?: string;
  maskedPhone?: string;
  codeExpiresAtMs: number;
  resendAvailableAtMs: number;
  email?: string;
  phone_number?: string;
};

type StartPayload = { email?: string; phone_number?: string };

type FlowStartResponse = {
  flowId?: string;
  channel?: OtpChannelChoice;
  maskedEmail?: string;
  maskedPhone?: string;
  codeExpiresAt?: string;
  resendAvailableAt?: string;
  expiresAt?: string;
};

export function useAuthGateOtp() {
  const apiClient = useApiClient();
  const { t } = useTranslation();
  const [flow, setFlow] = useState<AuthGateFlowState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyStartResponse = useCallback(
    (payload: StartPayload, data: FlowStartResponse) => {
      const flowId = data.flowId?.trim();
      if (!flowId) throw new Error('Missing flow id');
      const channel = data.channel || (payload.email ? 'email' : 'sms');
      setFlow({
        flowId,
        channel,
        maskedEmail: data.maskedEmail,
        maskedPhone: data.maskedPhone,
        codeExpiresAtMs: data.codeExpiresAt
          ? Date.parse(data.codeExpiresAt)
          : Date.now() + msUntil(undefined, 10 * 60 * 1000),
        resendAvailableAtMs: data.resendAvailableAt
          ? Date.parse(data.resendAvailableAt)
          : Date.now() + msUntil(undefined, 2 * 60 * 1000),
        ...payload,
      });
    },
    []
  );

  const startFlow = useCallback(
    async (payload: StartPayload) => {
      setBusy(true);
      setError(null);
      try {
        const { data } = await apiClient.post<FlowStartResponse>(
          '/auth/login/start-otp',
          { ...payload, flow_version: 2 },
          { headers: { 'X-Client-Platform': 'web' } }
        );
        applyStartResponse(payload, data);
        return true;
      } catch (err: any) {
        setError(mapAuthGateApiError(err, t));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [apiClient, applyStartResponse, t]
  );

  const resendFlow = useCallback(async () => {
    if (!flow) return false;
    const payload: StartPayload = flow.email
      ? { email: flow.email }
      : { phone_number: flow.phone_number };
    return startFlow(payload);
  }, [flow, startFlow]);

  const verifyOtp = useCallback(
    async (otp: string) => {
      if (!flow) return { ok: false as const };
      setBusy(true);
      setError(null);
      try {
        const { data } = await apiClient.post(
          '/auth/login/verify-otp',
          { flowId: flow.flowId, otp, flow_version: 2 },
          { headers: { 'X-Client-Platform': 'web' } }
        );
        if (data?.next === 'finish_account') {
          return { ok: false as const, finishAccount: true, flowId: data.flowId };
        }
        if (data?.access_token) {
          return { ok: true as const, session: data };
        }
        setError(
          t('auth.gate.invalidCode', 'That code did not work. Please try again.')
        );
        return { ok: false as const };
      } catch (err: any) {
        setError(mapAuthGateApiError(err, t));
        return { ok: false as const };
      } finally {
        setBusy(false);
      }
    },
    [apiClient, flow, t]
  );

  const resetFlow = useCallback(() => {
    setFlow(null);
    setError(null);
    setBusy(false);
  }, []);

  return {
    flow,
    busy,
    error,
    setError,
    startFlow,
    resendFlow,
    verifyOtp,
    resetFlow,
  };
}
