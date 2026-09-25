import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  mapPasswordLoginError,
  parseLockoutFromError,
} from '../utils/authGateErrors';
import { useApiClient } from './useApiClient';

export type PasswordLoginSession = {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
};

export function useAuthGatePassword() {
  const apiClient = useApiClient();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockoutUntilMs, setLockoutUntilMs] = useState<number | null>(null);

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      setBusy(true);
      setError(null);
      setLockoutUntilMs(null);
      try {
        const { data } = await apiClient.post<PasswordLoginSession>(
          '/auth/password-login',
          {
            email: payload.email.trim().toLowerCase(),
            password: payload.password,
          },
          { headers: { 'X-Client-Platform': 'web' } }
        );
        if (data?.access_token) {
          return { ok: true as const, session: data };
        }
        setError(
          t(
            'auth.gate.wrongPassword',
            "That email or password isn't right."
          )
        );
        return { ok: false as const };
      } catch (err: any) {
        setError(mapPasswordLoginError(err, t));
        const lockout = parseLockoutFromError(err);
        if (lockout) setLockoutUntilMs(lockout.lockedUntilMs);
        return { ok: false as const, error: err };
      } finally {
        setBusy(false);
      }
    },
    [apiClient, t]
  );

  return {
    busy,
    error,
    setError,
    lockoutUntilMs,
    clearLockout: () => setLockoutUntilMs(null),
    login,
  };
}
