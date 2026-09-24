import { useSnackbar } from 'notistack';
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from './SessionAuthContext';
import { useClientFlags } from '../hooks/useClientFlags';
import { useAuthFunnelTracking } from '../hooks/useAuthFunnelTracking';
import { completeAuthIntentFromPendingStorage } from '../utils/authFunnelTracking';
import AuthGate from '../components/auth/AuthGate';
import type { AuthGateIntent, AuthGateStep } from '../types/authGate';
import {
  getAuthGateIntentErrorMessage,
  getAuthGateSuccessToast,
} from '../utils/authGateIntentMessages';

type AuthGateContextValue = {
  flagOn: boolean;
  requireAuth: (intent: AuthGateIntent) => Promise<boolean>;
  openGenericGate: () => void;
};

const AuthGateContext = createContext<AuthGateContextValue | null>(null);

export const AuthGateProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated, setPasswordlessSession, user } = useSessionAuth();
  const { flags } = useClientFlags();
  const flagOn = flags.auth_web_inapp_gates ?? false;
  const funnel = useAuthFunnelTracking('auth_gate');
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<AuthGateStep>('identifier');
  const [intent, setIntent] = useState<AuthGateIntent | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const intentRanRef = useRef(false);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
  }, []);

  const dismiss = useCallback(
    (entry: string) => {
      if (flagOn) funnel.trackAuthGateDismissed(entry, 'inapp');
      setOpen(false);
      setIntent(null);
      setStep('identifier');
      intentRanRef.current = false;
      settle(false);
    },
    [flagOn, funnel, settle]
  );

  const runIntentOnce = useCallback(
    async (active: AuthGateIntent | null) => {
      if (!active?.run || intentRanRef.current) return;
      intentRanRef.current = true;
      try {
        await active.run();
        const toast = getAuthGateSuccessToast(active.context);
        if (toast) {
          enqueueSnackbar(t(toast.key, toast.defaultValue), {
            variant: 'success',
          });
        }
      } catch (error: unknown) {
        enqueueSnackbar(getAuthGateIntentErrorMessage(error, t), {
          variant: 'error',
        });
      }
    },
    [enqueueSnackbar, t]
  );

  const completeSuccess = useCallback(
    async (active: AuthGateIntent | null) => {
      await runIntentOnce(active);
      void completeAuthIntentFromPendingStorage(user?.sub);
      setOpen(false);
      setIntent(null);
      setStep('identifier');
      settle(true);
    },
    [runIntentOnce, settle, user?.sub]
  );

  const requireAuth = useCallback(
    (nextIntent: AuthGateIntent): Promise<boolean> => {
      if (isAuthenticated) {
        return runIntentOnce(nextIntent).then(() => true);
      }
      if (!flagOn) return Promise.resolve(false);
      intentRanRef.current = false;
      setIntent(nextIntent);
      setStep('identifier');
      setOpen(true);
      funnel.trackAuthGateShown(nextIntent.entry, 'inapp');
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
      });
    },
    [flagOn, funnel, isAuthenticated, runIntentOnce]
  );

  const openGenericGate = useCallback(() => {
    void requireAuth({ context: 'generic', entry: 'otp_auth_page' });
  }, [requireAuth]);

  const value = useMemo(
    () => ({ flagOn, requireAuth, openGenericGate }),
    [flagOn, openGenericGate, requireAuth]
  );

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      {flagOn && (
        <AuthGate
          open={open}
          step={step}
          intent={intent}
          onStepChange={setStep}
          onDismiss={() => dismiss(intent?.entry ?? 'auth_gate')}
          onAuthSuccess={(session) => {
            setPasswordlessSession(session);
            void completeSuccess(intent);
          }}
        />
      )}
    </AuthGateContext.Provider>
  );
};

export function useAuthGate(): AuthGateContextValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) {
    throw new Error('useAuthGate must be used within AuthGateProvider');
  }
  return ctx;
}
