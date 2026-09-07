import { useCallback, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../stores/RootStore';
import type { AuthStackParamList } from '../navigation/types';
import { isValidEmailFormat } from './useSignupEmailAvailability';

export type SignupLoginPrompt = { channel: 'phone'; phoneE164: string };

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Signup'>;

export function useSignupExistingAccountLogin(navigation: Nav, email: string) {
  const { auth } = useStore();
  const [prompt, setPrompt] = useState<SignupLoginPrompt | null>(null);
  const [busy, setBusy] = useState(false);

  const offerPhoneLogin = useCallback((phoneE164: string) => {
    setPrompt({ channel: 'phone', phoneE164 });
  }, []);

  const dismiss = useCallback(() => {
    setPrompt(null);
  }, []);

  const goToEmailOtp = useCallback(
    async (value: string) => {
      const ok = await auth.requestPasswordlessEmailOtp(value);
      if (!ok) return auth.error;
      navigation.navigate('OtpVerification', {
        channel: 'email',
        email: value,
        flow: 'login',
      });
      return null;
    },
    [auth, navigation]
  );

  const goToPhoneOtp = useCallback(
    async (phoneE164: string) => {
      const ok = await auth.requestPasswordlessSms(phoneE164);
      if (!ok) return auth.error;
      navigation.navigate('OtpVerification', {
        channel: 'phone',
        phoneE164,
        flow: 'login',
      });
      return null;
    },
    [auth, navigation]
  );

  const loginWithTakenEmail = useCallback(async (): Promise<string | null> => {
    const trimmed = email.trim();
    if (!isValidEmailFormat(trimmed) || busy) return null;
    setBusy(true);
    try {
      return goToEmailOtp(trimmed);
    } finally {
      setBusy(false);
    }
  }, [busy, email, goToEmailOtp]);

  const confirm = useCallback(async (): Promise<string | null> => {
    if (!prompt || busy) return null;
    setBusy(true);
    try {
      return goToPhoneOtp(prompt.phoneE164);
    } finally {
      setBusy(false);
    }
  }, [busy, goToPhoneOtp, prompt]);

  return { prompt, offerPhoneLogin, dismiss, confirm, loginWithTakenEmail, busy };
}
