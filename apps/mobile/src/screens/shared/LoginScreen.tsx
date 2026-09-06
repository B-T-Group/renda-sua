import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { CountryCode } from 'libphonenumber-js';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text, TextInput } from 'react-native-paper';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { AppButton, GhostButton } from '../../components/common/AppButton';
import { AuthSettingsMenu } from '../../components/auth/AuthSettingsMenu';
import { NoticeBanner } from '../../components/common/NoticeBanner';
import Logo from '../../components/Logo';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { getDefaultLoginMethod, type LoginIdentifierMode } from '../../utils/authDefaults';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import type { LoginScreenProps } from '../../navigation/types';
import { getAuthFlowErrorKey } from '../../utils/authErrorI18nKey';
import {
  keyboardAwareScrollProps,
  useKeyboardVerticalOffset,
} from '../../hooks/useKeyboardVerticalOffset';

type EmailSignInMode = 'password' | 'otp';

function LoginScreen({ navigation }: LoginScreenProps) {
  const { t } = useTranslation();
  const { colors, typography, borderRadius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const scrollBottomPad = tabBarHeight + spacing.lg;
  const keyboardVerticalOffset = useKeyboardVerticalOffset(12);
  const { auth, savedAccounts } = useStore();
  const [loginMethod, setLoginMethod] = useState<LoginIdentifierMode>(
    () => getDefaultLoginMethod(getDeviceDefaultCountryCode())
  );
  const [emailSignInMode, setEmailSignInMode] = useState<EmailSignInMode>('otp');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() => getDeviceDefaultCountryCode());
  const [phoneNationalDigits, setPhoneNationalDigits] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const clearErrors = useCallback(() => {
    setValidationError(null);
    if (auth.error) auth.clearError();
  }, [auth]);

  const handleEmailChange = useCallback(
    (text: string) => {
      setEmail(text);
      clearErrors();
    },
    [clearErrors]
  );

  const handlePasswordChange = useCallback(
    (text: string) => {
      setPassword(text);
      clearErrors();
    },
    [clearErrors]
  );

  const switchToEmail = useCallback(() => {
    setLoginMethod('email');
    setEmailSignInMode('otp');
    setValidationError(null);
    auth.clearError();
  }, [auth]);

  const switchToPhone = useCallback(() => {
    setLoginMethod('phone');
    setValidationError(null);
    auth.clearError();
  }, [auth]);

  const setEmailSignInModeAndClear = useCallback(
    (mode: EmailSignInMode) => {
      setEmailSignInMode(mode);
      setValidationError(null);
      auth.clearError();
    },
    [auth]
  );

  const handlePhoneNationalChange = useCallback(
    (digits: string) => {
      setPhoneNationalDigits(digits);
      clearErrors();
    },
    [clearErrors]
  );

  const handlePhoneCountryChange = useCallback(
    (iso: CountryCode) => {
      setPhoneCountry(iso);
      clearErrors();
    },
    [clearErrors]
  );

  const handleLogin = async () => {
    setValidationError(null);
    auth.clearError();
    if (loginMethod === 'email') {
      if (!email.trim()) {
        setValidationError(t('auth.errors.requiredEmail'));
        return;
      }
      if (emailSignInMode === 'password') {
        if (!password) {
          setValidationError(t('auth.errors.requiredPassword'));
          return;
        }
        await auth.loginWithCredentials(email.trim(), password);
        return;
      }
      const ok = await auth.requestPasswordlessEmailOtp(email.trim());
      if (ok) {
        navigation.navigate('OtpVerification', { channel: 'email', email: email.trim() });
      }
      return;
    }
    if (!phoneNationalDigits.trim()) {
      setValidationError(t('auth.errors.requiredPhone'));
      return;
    }
    const e164 = nationalDigitsToE164(phoneCountry, phoneNationalDigits);
    if (!e164) {
      setValidationError(t('auth.errors.invalidPhone'));
      return;
    }
    const ok = await auth.requestPasswordlessSms(e164);
    if (ok) {
      navigation.navigate('OtpVerification', { channel: 'phone', phoneE164: e164 });
    }
  };

  const displayError =
    validationError || (auth.error ? t(getAuthFlowErrorKey(auth.error)) : null);

  const ctaLabel =
    loginMethod === 'phone' || emailSignInMode === 'otp'
      ? t('auth.sendCodeButton')
      : t('auth.loginButton');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.pageBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <AuthSettingsMenu onAboutPress={() => navigation.navigate('About')} />

      <ScrollView
        {...keyboardAwareScrollProps}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: scrollBottomPad, paddingTop: Math.max(32, insets.top + 8) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          <View style={styles.logoWrap}>
            <Logo />
          </View>
          <Text variant="headlineMedium" style={[styles.title, { color: colors.text.primary }]}>
            {t('auth.login')}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t('auth.loginSubtitle')}
          </Text>

          {/* Error banner — always visible at top of form */}
          {displayError ? (
            <NoticeBanner
              tone="error"
              message={displayError}
              style={styles.errorBanner}
            />
          ) : null}

          {/* Phone input */}
          {loginMethod === 'phone' ? (
            <>
              <Text style={[styles.label, { color: colors.text.primary }, typography.subtitle2]}>
                {t('auth.phone')}
              </Text>
              <PhoneNumberInput
                countryIso={phoneCountry}
                nationalDigits={phoneNationalDigits}
                onCountryIsoChange={handlePhoneCountryChange}
                onNationalDigitsChange={handlePhoneNationalChange}
                hasError={!!displayError}
                disabled={auth.isLoading}
              />
              <Pressable
                onPress={switchToEmail}
                disabled={auth.isLoading}
                style={styles.switchMethodLink}
                accessibilityRole="button"
              >
                <Text variant="bodyMedium" style={{ color: colors.primary.main }}>
                  {t('auth.useEmailInstead', 'Use email instead')}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              {/* Email input */}
              <TextInput
                mode="outlined"
                label={t('auth.email')}
                value={email}
                onChangeText={handleEmailChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={!auth.isLoading}
                error={!!displayError}
                style={styles.textInput}
                accessibilityLabel={t('auth.email')}
              />

              {/* OTP / Password sub-toggle */}
              <View style={[styles.methodToggleRow, { borderColor: colors.divider }]}>
                <Pressable
                  onPress={() => setEmailSignInModeAndClear('otp')}
                  style={[
                    styles.methodToggleChip,
                    {
                      backgroundColor:
                        emailSignInMode === 'otp'
                          ? colors.primary.main + '22'
                          : 'transparent',
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: emailSignInMode === 'otp' }}
                >
                  <Text
                    variant="labelMedium"
                    style={{
                      color:
                        emailSignInMode === 'otp'
                          ? colors.primary.main
                          : colors.text.secondary,
                      fontWeight: emailSignInMode === 'otp' ? '700' : '400',
                    }}
                  >
                    {t('auth.signInWithOtp', 'Send code')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setEmailSignInModeAndClear('password')}
                  style={[
                    styles.methodToggleChip,
                    {
                      backgroundColor:
                        emailSignInMode === 'password'
                          ? colors.primary.main + '22'
                          : 'transparent',
                      borderRadius: borderRadius.sm,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: emailSignInMode === 'password' }}
                >
                  <Text
                    variant="labelMedium"
                    style={{
                      color:
                        emailSignInMode === 'password'
                          ? colors.primary.main
                          : colors.text.secondary,
                      fontWeight: emailSignInMode === 'password' ? '700' : '400',
                    }}
                  >
                    {t('auth.signInWithPassword', 'Password')}
                  </Text>
                </Pressable>
              </View>

              {/* Password field */}
              {emailSignInMode === 'password' ? (
                <TextInput
                  mode="outlined"
                  label={t('auth.password')}
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!passwordVisible}
                  textContentType="password"
                  editable={!auth.isLoading}
                  error={!!displayError}
                  style={styles.textInput}
                  accessibilityLabel={t('auth.password')}
                  right={
                    <TextInput.Icon
                      icon={passwordVisible ? 'eye-off' : 'eye'}
                      onPress={() => setPasswordVisible((v) => !v)}
                    />
                  }
                />
              ) : null}

              {/* Forgot password */}
              {emailSignInMode === 'password' ? (
                <Pressable
                  style={styles.forgotLink}
                  onPress={() => navigation.navigate('ResetPassword')}
                  disabled={auth.isLoading}
                  accessibilityRole="button"
                >
                  <Text variant="bodySmall" style={{ color: colors.primary.main }}>
                    {t('auth.resetPassword.title', 'Reset password')}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={switchToPhone}
                disabled={auth.isLoading}
                style={styles.switchMethodLink}
                accessibilityRole="button"
              >
                <Text variant="bodyMedium" style={{ color: colors.primary.main }}>
                  {t('auth.usePhoneInstead', 'Use phone instead')}
                </Text>
              </Pressable>
            </>
          )}

          <AppButton
            label={ctaLabel}
            onPress={() => void handleLogin()}
            loading={auth.isLoading}
            fullWidth
            style={styles.ctaButton}
          />

          <View style={[styles.signupBlock, { borderTopColor: colors.divider }]}>
            {savedAccounts.shouldShowContinueAs ? (
              <Pressable
                onPress={() => navigation.navigate('SavedAccounts', { mode: 'continue' })}
                disabled={auth.isLoading}
                style={styles.switchMethodLink}
                accessibilityRole="button"
              >
                <Text variant="bodyMedium" style={{ color: colors.primary.main }}>
                  {t('savedAccounts.backToSavedAccounts', 'Back to saved accounts')}
                </Text>
              </Pressable>
            ) : null}
            <Text
              variant="bodyMedium"
              style={[styles.signupPrompt, { color: colors.text.primary }]}
            >
              {t('auth.noAccount', 'No account yet?')}
            </Text>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Signup')}
              disabled={auth.isLoading}
              style={styles.signupButton}
              labelStyle={styles.signupButtonLabel}
            >
              {t('auth.signup', 'Sign up')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 32,
  },
  form: {
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  logoWrap: {
    marginBottom: 24,
    alignItems: 'center',
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  errorBanner: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    marginTop: 4,
  },
  textInput: {
    marginBottom: 8,
  },
  methodToggleRow: {
    flexDirection: 'row',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 4,
    marginBottom: 8,
  },
  methodToggleChip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forgotLink: {
    alignSelf: 'flex-end',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
    minHeight: 36,
    justifyContent: 'center',
  },
  switchMethodLink: {
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  ctaButton: {
    marginTop: 8,
  },
  signupBlock: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'stretch',
    gap: 12,
  },
  signupPrompt: {
    textAlign: 'center',
    fontWeight: '600',
  },
  signupButton: {
    alignSelf: 'stretch',
  },
  signupButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default observer(LoginScreen);
