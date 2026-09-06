import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { ActivityIndicator, Text } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { OtpInput } from '../OtpInput';
import { getEnv } from '../../config/auth0';
import { startLoginOtpEmail, startLoginOtpSms } from '../../services/rendasuaLoginOtpService';
import { resendSignupOtp } from '../../services/rendasuaSignupOtpService';
import { maskEmail, maskPhoneE164 } from '../../utils/agentProfileDisplay';
import { getAuthFlowErrorKey } from '../../utils/authErrorI18nKey';

const RESEND_COOLDOWN_SEC = 120;

export type CheckoutOtpTarget =
  | { channel: 'phone'; value: string; attemptId?: string }
  | { channel: 'email'; value: string; attemptId?: string };

export interface PublicCheckoutOtpStepProps {
  target: CheckoutOtpTarget;
}

function formatCountdownMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PublicCheckoutOtpStep({ target }: PublicCheckoutOtpStepProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius } = useTheme();
  const { auth } = useStore();
  const isPhone = target.channel === 'phone';
  const isSignup = Boolean(target.attemptId);
  const otpLength = getEnv().auth0Config.otpLength;

  const [otp, setOtp] = useState('');
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SEC);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const verifyingRef = useRef(false);
  const [verifiedPending, setVerifiedPending] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const id = setInterval(() => setResendSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendSeconds]);

  const runVerify = useCallback(
    async (code: string) => {
      if (verifyingRef.current) return;
      verifyingRef.current = true;
      auth.clearError();
      setResendError(null);

      if (isSignup && target.attemptId) {
        const result = await auth.completeSignupWithOtp(target.attemptId, code);
        if (result.ok) {
          setVerifiedPending(true);
          return;
        }
        setOtp('');
        verifyingRef.current = false;
        return;
      }

      const ok = isPhone
        ? await auth.loginWithPasswordlessOtp(target.value, code)
        : await auth.loginWithPasswordlessEmailOtp(target.value, code);
      if (ok) {
        setVerifiedPending(true);
      } else {
        setOtp('');
        verifyingRef.current = false;
      }
    },
    [auth, isPhone, isSignup, target]
  );

  useEffect(() => {
    if (otp.length !== otpLength) return;
    void runVerify(otp);
  }, [otp, otpLength, runVerify]);

  const handleResend = async () => {
    if (resendSeconds > 0 || resendBusy || auth.isLoading) return;
    setResendBusy(true);
    setResendError(null);
    auth.clearError();

    if (isSignup && target.attemptId) {
      const r = await resendSignupOtp(target.attemptId);
      setResendBusy(false);
      if (r.ok) {
        setResendSeconds(RESEND_COOLDOWN_SEC);
        setOtp('');
      } else {
        setResendError(r.error);
      }
      return;
    }

    const r = isPhone
      ? await startLoginOtpSms(target.value)
      : await startLoginOtpEmail(target.value);
    setResendBusy(false);
    if (r.ok) {
      setResendSeconds(RESEND_COOLDOWN_SEC);
      setOtp('');
    } else {
      setResendError(r.error);
    }
  };

  const displayError = auth.error
    ? t(getAuthFlowErrorKey(auth.error))
    : resendError
      ? t(getAuthFlowErrorKey(resendError))
      : null;

  const masked = isPhone ? maskPhoneE164(target.value) : maskEmail(target.value);
  const subtitleKey = isPhone ? 'auth.otp.subtitle' : 'auth.otp.subtitleEmail';
  const subtitleDefault = isPhone ? 'We sent a code to {{phone}}.' : 'We sent a code to {{email}}.';
  const subtitleParams = isPhone ? { phone: masked } : { email: masked };
  const resendDisabled = resendSeconds > 0 || resendBusy || auth.isLoading;

  if (verifiedPending) {
    return (
      <View style={styles.transitionWrap}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginTop: 16, textAlign: 'center' }}>
          {t('public.items.checkoutDialog.takingToCheckout', 'Taking you to checkout\u2026')}
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 20 }}>
        {t(subtitleKey, { defaultValue: subtitleDefault, ...subtitleParams })}
      </Text>

      <View style={styles.otpWrap}>
        <OtpInput length={otpLength} value={otp} onChange={setOtp} disabled={auth.isLoading} />
      </View>

      {displayError ? (
        <View
          style={[
            styles.errorBanner,
            {
              backgroundColor: colors.error.main + '18',
              borderColor: colors.error.main,
              borderRadius: borderRadius.md,
            },
          ]}
        >
          <Text variant="bodySmall" style={{ color: colors.error.main }} numberOfLines={4}>
            {displayError}
          </Text>
        </View>
      ) : null}

      {auth.isLoading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary.main} />
      ) : null}

      <Pressable
        onPress={handleResend}
        disabled={resendDisabled}
        style={({ pressed }) => [styles.resend, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Text
          style={[
            typography.button,
            { color: resendDisabled ? colors.text.disabled : colors.primary.main },
          ]}
        >
          {resendSeconds > 0
            ? t('auth.otp.resendIn', 'Resend in {{time}}', { time: formatCountdownMmSs(resendSeconds) })
            : t('auth.otp.resend', 'Resend code')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  otpWrap: { marginBottom: 20 },
  errorBanner: { borderWidth: 1, padding: 14, marginBottom: 16 },
  loader: { marginVertical: 12 },
  resend: { alignItems: 'center', paddingVertical: 12 },
  transitionWrap: { alignItems: 'center', paddingVertical: 40 },
});

export default observer(PublicCheckoutOtpStep);
