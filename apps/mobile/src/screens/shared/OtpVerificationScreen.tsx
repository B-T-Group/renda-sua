import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { OtpInput } from '../../components/OtpInput';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { GhostButton } from '../../components/common/AppButton';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import { getEnv } from '../../config/auth0';
import { startLoginOtpEmail, startLoginOtpSms } from '../../services/rendasuaLoginOtpService';
import { resendSignupOtp } from '../../services/rendasuaSignupOtpService';
import { maskEmail, maskPhoneE164 } from '../../utils/agentProfileDisplay';
import { getAuthFlowErrorKey } from '../../utils/authErrorI18nKey';
import type { OtpVerificationScreenProps } from '../../navigation/types';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import StorageService from '../../services/storage/StorageService';
import { clearSignupDraft } from '../../components/signup/wizard/useSignupDraft';
import { trackSignupCompleted } from '../../utils/ftueAnalytics';

const RESEND_COOLDOWN_SEC = 120;

function formatCountdownMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OtpVerificationScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollBottomPad = tabBarHeight + spacing.lg;
  const keyboardVerticalOffset = useKeyboardVerticalOffset(12);
  const { auth } = useStore();
  const navigation = useNavigation<OtpVerificationScreenProps['navigation']>();
  const route = useRoute<OtpVerificationScreenProps['route']>();
  const params = route.params;
  const isPhone = params.channel === 'phone';
  const isSignup = params.flow === 'signup';
  const otpLength = getEnv().auth0Config.otpLength;

  const [otp, setOtp] = useState('');
  const [resendSeconds, setResendSeconds] = useState(RESEND_COOLDOWN_SEC);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const verifyingRef = useRef(false);

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

      if (isSignup) {
        const attemptId = params.attemptId;
        if (!attemptId) {
          setResendError('auth.signupFlow.attemptMissing');
          setOtp('');
          verifyingRef.current = false;
          return;
        }
        const result = await auth.completeSignupWithOtp(attemptId, code);
        if (result.ok) {
          auth.setSignupWelcomePending();
          trackSignupCompleted({
            source: params.signupSource ?? 'organic',
            persona: auth.signupWelcomePersona,
          });
          await clearSignupDraft();
          void StorageService.remove(STORAGE_KEYS.pendingSignupAttemptId);
          return;
        }
        setOtp('');
        verifyingRef.current = false;
        return;
      }

      const ok = isPhone
        ? await auth.loginWithPasswordlessOtp(params.phoneE164, code)
        : await auth.loginWithPasswordlessEmailOtp(params.email, code);
      if (!ok) {
        setOtp('');
        verifyingRef.current = false;
      }
    },
    [auth, isPhone, isSignup, params, t]
  );

  useEffect(() => {
    if (otp.length !== otpLength) return;
    void runVerify(otp);
  }, [otp, otpLength, runVerify]);

  const handleResend = async () => {
    if (resendSeconds > 0 || resendBusy) return;
    setResendBusy(true);
    setResendError(null);
    auth.clearError();

    if (isSignup) {
      const attemptId = params.attemptId;
      if (!attemptId) {
        setResendBusy(false);
        setResendError('auth.signupFlow.attemptMissing');
        return;
      }
      const r = await resendSignupOtp(attemptId);
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
      ? await startLoginOtpSms(params.phoneE164)
      : await startLoginOtpEmail(params.email);
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
      ? resendError.startsWith('auth.')
        ? t(
            resendError,
            'Verification session expired. Please start signup again.'
          )
        : t(getAuthFlowErrorKey(resendError))
      : null;

  const masked = isPhone ? maskPhoneE164(params.phoneE164) : maskEmail(params.email);
  const subtitleKey = isPhone ? 'auth.otp.subtitle' : 'auth.otp.subtitleEmail';
  const subtitleParams = isPhone ? { phone: masked } : { email: masked };

  const isVerifying = auth.isLoading && otp.length === otpLength;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        {...keyboardAwareScrollProps}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad, paddingTop: Math.max(48, insets.top + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
          {t('auth.otp.title')}
        </Text>
        <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
          {t(subtitleKey, subtitleParams)}
        </Text>

        <View style={styles.otpWrap}>
          <OtpInput length={otpLength} value={otp} onChange={setOtp} disabled={auth.isLoading} />
        </View>

        {isVerifying ? (
          <View style={styles.verifyingRow}>
            <ActivityIndicator size="small" color={colors.primary.main} />
            <Text variant="bodyMedium" style={[styles.verifyingText, { color: colors.text.secondary }]}>
              {t('auth.otp.verifying', 'Verifying your code…')}
            </Text>
          </View>
        ) : null}

        {displayError && !isVerifying ? (
          <NoticeBanner
            tone="error"
            message={displayError}
            style={styles.errorBanner}
          />
        ) : null}

        {!isVerifying ? (
          <>
            {isPhone ? (
              <Text variant="bodySmall" style={[styles.deliveryHint, { color: colors.text.secondary }]}>
                {t('auth.otp.deliveryHint', 'SMS can take up to a minute to arrive.')}
              </Text>
            ) : null}

            <GhostButton
              label={
                resendSeconds > 0
                  ? t('auth.otp.resendIn', 'Resend in {{time}}', {
                      time: formatCountdownMmSs(resendSeconds),
                    })
                  : t('auth.otp.resend')
              }
              onPress={() => void handleResend()}
              disabled={resendSeconds > 0 || resendBusy || auth.isLoading}
              fullWidth
              style={styles.resendButton}
            />

            <GhostButton
              label={isPhone ? t('auth.otp.changeNumber') : t('auth.otp.changeEmail')}
              onPress={() => navigation.goBack()}
              disabled={auth.isLoading}
              fullWidth
            />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  title: { marginBottom: 12, textAlign: 'center', fontWeight: '800' },
  subtitle: { textAlign: 'center', marginBottom: 32 },
  otpWrap: { marginBottom: 20 },
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  verifyingText: {},
  errorBanner: { marginBottom: 16 },
  deliveryHint: { textAlign: 'center', marginBottom: 8 },
  resendButton: { marginBottom: 4 },
});

export default observer(OtpVerificationScreen);
