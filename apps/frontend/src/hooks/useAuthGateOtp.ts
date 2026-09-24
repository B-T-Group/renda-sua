import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiClient } from './useApiClient';
import {
  mapAuthGateApiError,
  parseLockoutFromError,
} from '../utils/authGateErrors';
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
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);

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
      setLockoutUntilMs(null);
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
        const lockout = parseLockoutFromError(err);
        if (lockout) setLockoutUntilMs(lockout.lockedUntilMs);
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
      setLockoutUntilMs(null);
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
        const lockout = parseLockoutFromError(err);
        if (lockout) setLockoutUntilMs(lockout.lockedUntilMs);
        return { ok: false as const };
      } finally {
        setBusy(false);
      }
    },
    [apiClient, flow, t]
  );

  const finishAccount = useCallback(
    async (payload: {
      flowId: string;
      first_name: string;
      last_name: string;
      accept_terms: boolean;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const { data } = await apiClient.post(
          '/auth/signup/finish',
          {
            flowId: payload.flowId,
            first_name: payload.first_name,
            last_name: payload.last_name,
            accept_terms: payload.accept_terms,
            user_type_id: 'client',
            personas: ['client'],
            profile: {},
          },
          { headers: { 'X-Client-Platform': 'web' } }
        );
        if (data?.access_token) {
          return { ok: true as const, session: data };
        }
        setError(
          t('auth.gate.genericError', 'Something went wrong. Please try again.')
        );
        return { ok: false as const };
      } catch (err: any) {
        setError(mapAuthGateApiError(err, t));
        return { ok: false as const };
      } finally {
        setBusy(false);
      }
    },
    [apiClient, t]
  );

  const resetFlow = useCallback(() => {
    setFlow(null);
    setError(null);
    setBusy(false);
    setLockoutUntilMs(null);
  }, []);

  const clearLockout = useCallback(() => {
    setLockoutUntilMs(null);
  }, []);

  return {
    flow,
    busy,
    error,
    setError,
    lockoutUntilMs,
    clearLockout,
    startFlow,
    resendFlow,
    verifyOtp,
    finishAccount,
    resetFlow,
  };
}
