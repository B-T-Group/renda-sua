import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import { isSupportedCountry, isValidPhoneNumber } from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Button,
  Divider,
  Portal,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../contexts/ThemeContext';
import { useStore } from '../../stores/RootStore';
import { useImageFallback } from '../../hooks/useImageFallback';
import PhoneNumberInput from '../PhoneNumberInput';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { getCountryDisplayName } from '../../utils/phoneCountryOptions';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import {
  getEmailAvailability,
  getPhoneAvailability,
  postSignupStart,
} from '../../services/publicAuthApi';
import PublicCheckoutOtpStep, { type CheckoutOtpTarget } from './PublicCheckoutOtpStep';
import type { VerificationMethod } from '../../types/checkout';

export interface PublicCheckoutItemSummary {
  title: string;
  imageUrl?: string | null;
  priceText: string;
  /** ISO2 country code of the item's location, used to validate payment phone country. */
  countryCode?: string | null;
}

export interface PublicItemCheckoutSheetProps {
  visible: boolean;
  inventoryItemId: string;
  item: PublicCheckoutItemSummary;
  onDismiss: () => void;
  /**
   * Authoritative verification method from POST /orders/checkout/preflight.
   * EMAIL → show only email fields and email OTP (Stripe countries).
   * PHONE → show only phone fields and SMS OTP (Mobile Money countries).
   *
   * When null/undefined the sheet shows a loading indicator while the parent
   * fetches the preflight result.
   */
  resolvedVerificationMethod?: VerificationMethod | null;
  /** True while the parent is fetching the preflight result. */
  resolvingCheckout?: boolean;
  /** A blocking error from the preflight result. Shown before the form. */
  preflightBlocker?: string | null;
}

type ContactMethod = 'phone' | 'email';
type CheckoutSheetMode = 'signup' | 'login';
type CheckoutStep = 'details' | 'otp';

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

function isConflictSignupError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes('taken') || m.includes('conflict') || m.includes('409');
}

/** Prefer the item's location country, falling back to the device default. */
function resolveInitialPhoneCountry(itemCountryCode?: string | null): CountryCode {
  const code = itemCountryCode?.trim().toUpperCase();
  if (code && isSupportedCountry(code)) return code as CountryCode;
  return getDeviceDefaultCountryCode();
}

function PublicItemCheckoutSheetComponent({
  visible,
  inventoryItemId,
  item,
  onDismiss,
  resolvedVerificationMethod,
  resolvingCheckout = false,
  preflightBlocker,
}: PublicItemCheckoutSheetProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { auth } = useStore();
  const itemImage = useImageFallback(item.imageUrl);

  // Derive contact method from resolver; never let the user choose.
  const contactMethod: ContactMethod =
    resolvedVerificationMethod === 'EMAIL' ? 'email' : 'phone';

  const [step, setStep] = useState<CheckoutStep>('details');
  const [otpTarget, setOtpTarget] = useState<CheckoutOtpTarget | null>(null);

  const [sheetMode, setSheetMode] = useState<CheckoutSheetMode>('signup');
  const [email, setEmail] = useState('');
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(() =>
    resolveInitialPhoneCountry(item.countryCode)
  );
  const [phoneNationalDigits, setPhoneNationalDigits] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmailTaken, setCheckingEmailTaken] = useState(false);
  const [phoneTaken, setPhoneTaken] = useState(false);
  const [checkingPhoneTaken, setCheckingPhoneTaken] = useState(false);

  const emailNormalized = useMemo(() => email.trim().toLowerCase(), [email]);
  const phoneE164 = useMemo(
    () => nationalDigitsToE164(phoneCountry, phoneNationalDigits),
    [phoneCountry, phoneNationalDigits]
  );
  const isPhoneValid = useMemo(() => {
    if (!phoneE164) return false;
    try {
      return isValidPhoneNumber(phoneE164);
    } catch {
      return false;
    }
  }, [phoneE164]);
  const isEmailValid = useMemo(() => isValidEmailFormat(emailNormalized), [emailNormalized]);
  const itemCountryCode = item.countryCode?.trim().toUpperCase() || null;
  const itemCountryName = useMemo(
    () => (itemCountryCode ? getCountryDisplayName(i18n.language, itemCountryCode) : ''),
    [i18n.language, itemCountryCode]
  );
  // For Mobile Money: phone country must match the item/seller country.
  // This is now a blocking error, not just a warning.
  const phoneCountryBlocked = useMemo(
    () =>
      contactMethod === 'phone' &&
      !!itemCountryCode &&
      phoneCountry.toUpperCase() !== itemCountryCode,
    [contactMethod, itemCountryCode, phoneCountry]
  );

  useEffect(() => {
    if (!visible) return;
    setPhoneCountry(resolveInitialPhoneCountry(item.countryCode));
  }, [item.countryCode, visible]);

  useEffect(() => {
    if (step !== 'details' || !visible || contactMethod !== 'email' || !isEmailValid) {
      setEmailTaken(false);
      setCheckingEmailTaken(false);
      return;
    }
    let cancelled = false;
    setCheckingEmailTaken(true);
    setEmailTaken(false);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { taken } = await getEmailAvailability(emailNormalized);
          if (cancelled) return;
          setEmailTaken(taken);
          if (taken) setError(null);
        } catch {
          if (!cancelled) setEmailTaken(false);
        } finally {
          if (!cancelled) setCheckingEmailTaken(false);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contactMethod, emailNormalized, isEmailValid, step, visible]);

  useEffect(() => {
    if (
      step !== 'details' ||
      !visible ||
      sheetMode !== 'login' ||
      contactMethod !== 'phone' ||
      !isPhoneValid ||
      !phoneE164
    ) {
      setPhoneTaken(false);
      setCheckingPhoneTaken(false);
      return;
    }
    let cancelled = false;
    setCheckingPhoneTaken(true);
    setPhoneTaken(false);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { taken } = await getPhoneAvailability(phoneE164);
          if (cancelled) return;
          setPhoneTaken(taken);
        } catch {
          if (!cancelled) setPhoneTaken(false);
        } finally {
          if (!cancelled) setCheckingPhoneTaken(false);
        }
      })();
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contactMethod, isPhoneValid, phoneE164, sheetMode, step, visible]);

  const resetForm = useCallback(() => {
    setStep('details');
    setOtpTarget(null);
    setEmail('');
    setPhoneNationalDigits('');
    setFirstName('');
    setLastName('');
    setPhoneCountry(resolveInitialPhoneCountry(item.countryCode));
    setError(null);
    setEmailTaken(false);
    setCheckingEmailTaken(false);
    setPhoneTaken(false);
    setCheckingPhoneTaken(false);
    setSheetMode('signup');
  }, [item.countryCode]);

  const handleCancel = useCallback(() => {
    if (submitting) return;
    const authed = auth.isAuthenticated;
    if (!authed) auth.consumePostAuthResumeForInventoryItem();
    resetForm();
    onDismiss();
    if (!authed) {
      (navigation as { navigate: (name: string, params?: object) => void }).navigate('GuestTabs', {
        screen: 'GuestBrowse',
      });
    }
  }, [auth, navigation, onDismiss, resetForm, submitting]);

  const handleBackToDetails = useCallback(() => {
    if (auth.isLoading) return;
    auth.clearError();
    setError(null);
    setOtpTarget(null);
    setStep('details');
  }, [auth]);

  const enterLoginMode = useCallback(() => {
    if (submitting) return;
    setError(null);
    setSheetMode('login');
  }, [submitting]);

  // Switches to login mode and preserves the contact already entered.
  const enterLoginModeWithContact = useCallback(() => {
    if (submitting) return;
    setError(null);
    setSheetMode('login');
  }, [submitting]);

  const enterSignupMode = useCallback(() => {
    setError(null);
    setSheetMode('signup');
  }, []);

  const sendOtpAndAdvance = useCallback(
    async (nextAttemptId: string): Promise<void> => {
      const target: CheckoutOtpTarget =
        contactMethod === 'phone'
          ? { channel: 'phone', value: phoneE164 ?? '', attemptId: nextAttemptId }
          : { channel: 'email', value: emailNormalized, attemptId: nextAttemptId };
      if (!target.value) {
        setError(
          t('public.items.checkoutDialog.phoneInvalid', 'Please enter a valid phone number.')
        );
        return;
      }
      await auth.setPostAuthResumeForInventoryItem(inventoryItemId);
      setOtpTarget(target);
      setStep('otp');
    },
    [auth, contactMethod, emailNormalized, inventoryItemId, phoneE164, t]
  );

  const emailTakenMessage = useCallback(
    () =>
      t(
        'public.items.checkoutDialog.emailAlreadyRegistered',
        'This email is already registered. Use "Log in instead" or another email.'
      ),
    [t]
  );

  const startSignupAttempt = useCallback(
    async (contact: {
      email: string | null;
      phone_number: string | null;
    }): Promise<string | null> => {
      try {
        const res = await postSignupStart({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: contact.email,
          phone_number: contact.phone_number,
          personas: ['client'],
          user_type_id: 'client',
          profile: {},
          verification_channel: contactMethod === 'phone' ? 'sms' : 'email',
        });
        return res.attemptId;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        if (isConflictSignupError(msg)) {
          if (contactMethod === 'email') {
            setError(emailTakenMessage());
            return null;
          }
          setError(
            t(
              'public.items.checkoutDialog.phoneAlreadyRegistered',
              'This phone number is already registered. Use "Log in instead" or another number.'
            )
          );
          return null;
        }
        setError(
          msg || t('public.items.checkoutDialog.signupFailed', 'Could not start signup.')
        );
        return null;
      }
    },
    [contactMethod, emailTakenMessage, firstName, lastName, t]
  );

  const runSignupContinue = useCallback(async (): Promise<void> => {
    if (contactMethod === 'phone') {
      if (!phoneE164 || !isPhoneValid) {
        setError(t('public.items.checkoutDialog.phoneInvalid', 'Please enter a valid phone number.'));
        return;
      }
      const { taken } = await getPhoneAvailability(phoneE164);
      if (taken) {
        setError(
          t(
            'public.items.checkoutDialog.phoneAlreadyRegistered',
            'This phone number is already registered. Use "Log in instead" or another number.'
          )
        );
        return;
      }
      const nextAttemptId = await startSignupAttempt({
        email: null,
        phone_number: phoneE164,
      });
      if (!nextAttemptId) return;
      await sendOtpAndAdvance(nextAttemptId);
      return;
    }
    if (!isEmailValid) {
      setError(t('auth.errors.requiredEmail', 'Please enter your email address.'));
      return;
    }
    const { taken } = await getEmailAvailability(emailNormalized);
    if (taken) {
      setError(emailTakenMessage());
      return;
    }
    const nextAttemptId = await startSignupAttempt({
      email: emailNormalized,
      phone_number: null,
    });
    if (!nextAttemptId) return;
    await sendOtpAndAdvance(nextAttemptId);
  }, [
    contactMethod,
    emailNormalized,
    emailTakenMessage,
    isEmailValid,
    isPhoneValid,
    phoneE164,
    sendOtpAndAdvance,
    startSignupAttempt,
    t,
  ]);

  const runLoginContinue = useCallback(async (): Promise<void> => {
    if (contactMethod === 'phone') {
      if (!phoneE164 || !isPhoneValid) {
        setError(t('public.items.checkoutDialog.phoneInvalid', 'Please enter a valid phone number.'));
        return;
      }
      const { taken } = await getPhoneAvailability(phoneE164);
      if (!taken) {
        setError(
          t(
            'public.items.checkoutDialog.phoneNotRegistered',
            'No account uses this phone number. Sign up or check the number.'
          )
        );
        return;
      }
      const sent = await auth.requestPasswordlessSms(phoneE164);
      if (!sent) {
        setError(auth.error || t('auth.errors.generic', 'Something went wrong.'));
        return;
      }
      await auth.setPostAuthResumeForInventoryItem(inventoryItemId);
      setOtpTarget({ channel: 'phone', value: phoneE164 });
      setStep('otp');
      return;
    }
    if (!isEmailValid) {
      setError(t('auth.errors.requiredEmail', 'Please enter your email address.'));
      return;
    }
    const { taken } = await getEmailAvailability(emailNormalized);
    if (!taken) {
      setError(
        t(
          'public.items.checkoutDialog.emailNotRegistered',
          'No account uses this email. Sign up or check the address.'
        )
      );
      return;
    }
    const sent = await auth.requestPasswordlessEmailOtp(emailNormalized);
    if (!sent) {
      setError(auth.error || t('auth.errors.generic', 'Something went wrong.'));
      return;
    }
    await auth.setPostAuthResumeForInventoryItem(inventoryItemId);
    setOtpTarget({ channel: 'email', value: emailNormalized });
    setStep('otp');
  }, [
    auth,
    contactMethod,
    emailNormalized,
    inventoryItemId,
    isEmailValid,
    isPhoneValid,
    phoneE164,
    t,
  ]);

  const handleContinue = useCallback(async () => {
    if (submitting) return;
    setError(null);
    if (sheetMode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      setError(t('public.items.checkoutDialog.namesRequired', 'Please enter your first and last name.'));
      return;
    }
    setSubmitting(true);
    try {
      if (sheetMode === 'login') await runLoginContinue();
      else await runSignupContinue();
    } finally {
      setSubmitting(false);
    }
  }, [firstName, lastName, runLoginContinue, runSignupContinue, sheetMode, submitting, t]);

  // In signup mode, block submit while email is taken or being checked (to avoid duplicate account conflict).
  // In login mode, allow submit as long as format is valid — availability is an inline hint only;
  // the actual server call on submit will produce the authoritative error.
  const emailContinueBlocked =
    sheetMode === 'signup' && contactMethod === 'email' && isEmailValid && (emailTaken || checkingEmailTaken);

  const canSubmit =
    !resolvingCheckout &&
    !resolvedVerificationMethod === false && // has a resolved method
    !preflightBlocker &&
    (sheetMode === 'login'
      ? contactMethod === 'phone'
        ? isPhoneValid && !submitting && !phoneCountryBlocked
        : isEmailValid && !submitting
      : !!firstName.trim() &&
        !!lastName.trim() &&
        (contactMethod === 'phone' ? isPhoneValid && !phoneCountryBlocked : isEmailValid) &&
        !submitting &&
        !emailContinueBlocked);

  const isOtpStep = step === 'otp';
  const dialogTitle = isOtpStep
    ? t('auth.otp.title', 'Enter verification code')
    : sheetMode === 'login'
      ? t('public.items.checkoutDialog.loginTitle', 'Sign in')
      : t('public.items.checkoutDialog.title', 'Continue to checkout');

  if (!visible) return null;

  return (
    <Portal>
      <View style={[styles.fullscreen, { backgroundColor: colors.pageBackground, paddingTop: insets.top }]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.header}>
            <MaterialCommunityIcons
              name={isOtpStep ? 'cellphone-message' : 'shopping-outline'}
              size={24}
              color={colors.primary.main}
            />
            <Text variant="titleLarge" style={{ flex: 1, marginLeft: 8 }}>
              {dialogTitle}
            </Text>
          </View>
          <Divider />
          <ScrollView
            style={styles.flex}
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={[styles.itemCard, { borderColor: colors.divider, backgroundColor: colors.pageBackground }]}
            >
              {itemImage.hasImage && itemImage.sourceUri ? (
                <Image
                  source={{ uri: itemImage.sourceUri }}
                  style={styles.thumb}
                  resizeMode="cover"
                  onError={itemImage.onImageError}
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.surface, justifyContent: 'center' }]}>
                  <MaterialCommunityIcons name="image-off-outline" size={28} color={colors.text.disabled} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="titleSmall" numberOfLines={2}>
                  {item.title}
                </Text>
                <Text variant="titleMedium" style={{ color: colors.primary.main, marginTop: 4 }}>
                  {item.priceText}
                </Text>
              </View>
            </View>

            {isOtpStep && otpTarget ? (
              <PublicCheckoutOtpStep target={otpTarget} />
            ) : (
              <>
                <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: 12 }}>
                  {sheetMode === 'login'
                    ? t(
                        'public.items.checkoutDialog.subtitleSignIn',
                        'Verify your identity to continue to checkout and track your order.'
                      )
                    : t(
                        'public.items.checkoutDialog.subtitleCheckout',
                        'Almost there — verify your details to place your order and receive updates.'
                      )}
                </Text>

                {error ? (
                  <Text variant="bodySmall" style={{ color: colors.error.main, marginBottom: 8 }}>
                    {error}
                  </Text>
                ) : null}

                {/* Preflight loading indicator */}
                {resolvingCheckout && (
                  <View style={styles.resolverRow}>
                    <ActivityIndicator size="small" color={colors.primary.main} />
                    <Text variant="bodySmall" style={{ color: colors.text.secondary, marginLeft: 8 }}>
                      {t('checkout.resolving', 'Preparing your checkout…')}
                    </Text>
                  </View>
                )}

                {/* Blocking error from preflight */}
                {!resolvingCheckout && preflightBlocker ? (
                  <View style={styles.blockerRow}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.error.main} />
                    <Text variant="bodySmall" style={{ color: colors.error.main, marginLeft: 6, flex: 1 }}>
                      {preflightBlocker}
                    </Text>
                  </View>
                ) : null}

                {/* Capability-driven contact method hint — no user choice */}
                {!resolvingCheckout && resolvedVerificationMethod && (
                  <Text variant="bodySmall" style={{ color: colors.text.secondary, marginBottom: 12 }}>
                    {contactMethod === 'phone'
                      ? t(
                          'public.items.checkoutDialog.contactHintPhone',
                          'Required for Mobile Money payment and order updates.'
                        )
                      : t(
                          'public.items.checkoutDialog.contactHintEmailStripe',
                          'Best for card checkout — we’ll send a code and your receipt here.'
                        )}
                  </Text>
                )}

                {sheetMode === 'signup' ? (
                  <>
                    <TextInput
                      mode="outlined"
                      label={t('public.items.checkoutDialog.firstNameLabel', 'First name')}
                      value={firstName}
                      onChangeText={setFirstName}
                      disabled={submitting}
                      style={{ marginBottom: 8 }}
                    />
                    <TextInput
                      mode="outlined"
                      label={t('public.items.checkoutDialog.lastNameLabel', 'Last name')}
                      value={lastName}
                      onChangeText={setLastName}
                      disabled={submitting}
                      style={{ marginBottom: 12 }}
                    />
                  </>
                ) : null}

                {contactMethod === 'phone' ? (
                  <>
                    <PhoneNumberInput
                      countryIso={phoneCountry}
                      nationalDigits={phoneNationalDigits}
                      onCountryIsoChange={setPhoneCountry}
                      onNationalDigitsChange={setPhoneNationalDigits}
                      hasError={
                        phoneNationalDigits.length > 0 &&
                        (!isPhoneValid ||
                          (sheetMode === 'login' && isPhoneValid && !checkingPhoneTaken && !phoneTaken))
                      }
                      disabled={submitting}
                    />
                    {sheetMode === 'login' && isPhoneValid && !checkingPhoneTaken && !phoneTaken ? (
                      <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 6 }}>
                        {t(
                          'public.items.checkoutDialog.phoneNotRegistered',
                          'No account uses this phone number. Sign up or check the number.'
                        )}
                      </Text>
                    ) : null}
                    {sheetMode === 'signup' && isPhoneValid && phoneTaken && !checkingPhoneTaken ? (
                      <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall" style={{ color: colors.text.secondary }}>
                          {t(
                            'public.items.checkoutDialog.phoneAlreadyExists',
                            'This phone is already linked to an account.'
                          )}
                        </Text>
                        <Button
                          mode="text"
                          compact
                          onPress={enterLoginModeWithContact}
                          disabled={submitting}
                          style={{ alignSelf: 'flex-start', marginTop: 4 }}
                        >
                          {t(
                            'public.items.checkoutDialog.signInWithPhoneLink',
                            'Sign in with this phone instead'
                          )}
                        </Button>
                      </View>
                    ) : null}
                    {phoneCountryBlocked ? (
                      <View style={styles.blockerRow}>
                        <MaterialCommunityIcons
                          name="alert-circle-outline"
                          size={16}
                          color={colors.error.main}
                        />
                        <Text
                          variant="bodySmall"
                          style={{ color: colors.error.main, marginLeft: 6, flex: 1 }}
                        >
                          {t(
                            'public.items.checkoutDialog.phoneCountryBlocked',
                            'You must use a {{country}} phone number for Mobile Money payment on this item.',
                            { country: itemCountryName }
                          )}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <>
                    <TextInput
                      mode="outlined"
                      label={t('public.items.checkoutDialog.emailLabel', 'Email address')}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      disabled={submitting}
                      error={
                        sheetMode === 'signup'
                          ? emailTaken
                          : sheetMode === 'login' && isEmailValid && !checkingEmailTaken && !emailTaken
                      }
                    />
                    {sheetMode === 'login' && isEmailValid && !checkingEmailTaken && !emailTaken ? (
                      <Text variant="bodySmall" style={{ color: colors.error.main, marginTop: 6 }}>
                        {t(
                          'public.items.checkoutDialog.emailNotRegistered',
                          'No account uses this email. Sign up or check the address.'
                        )}
                      </Text>
                    ) : null}
                    {sheetMode === 'signup' && emailTaken && isEmailValid ? (
                      <View style={{ marginTop: 8 }}>
                        <Text variant="bodySmall" style={{ color: colors.error.main }}>
                          {t(
                            'public.items.checkoutDialog.emailAlreadyRegistered',
                            'This email is already registered.'
                          )}
                        </Text>
                        <Button
                          mode="text"
                          compact
                          onPress={enterLoginMode}
                          disabled={submitting}
                          style={{ alignSelf: 'flex-start', marginTop: 4 }}
                        >
                          {t(
                            'public.items.checkoutDialog.signInWithEmailLink',
                            'Sign in with this email instead'
                          )}
                        </Button>
                      </View>
                    ) : null}
                  </>
                )}

                <Text variant="bodySmall" style={{ color: colors.text.secondary, marginTop: 10 }}>
                  {contactMethod === 'phone'
                    ? t(
                        'public.items.checkoutDialog.trustBodyPhone',
                        'We’ll text a code to verify. Used for Mobile Money payment and order updates.'
                      )
                    : t(
                        'public.items.checkoutDialog.trustBodyEmailStripe',
                        'We’ll email a code to verify. Pay securely by card at checkout.'
                      )}
                </Text>
              </>
            )}
          </ScrollView>
          <Divider />
          <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
            {isOtpStep ? (
              <View style={styles.actionsRow}>
                <Button onPress={handleBackToDetails} disabled={auth.isLoading}>
                  {t('common.back', 'Back')}
                </Button>
                <Button onPress={handleCancel} disabled={auth.isLoading}>
                  {t('common.cancel', 'Cancel')}
                </Button>
              </View>
            ) : (
              <View style={styles.detailsActions}>
                {sheetMode === 'signup' ? (
                  <Button mode="text" onPress={enterLoginMode} disabled={submitting} style={{ alignSelf: 'center' }}>
                    {t('public.items.checkoutDialog.loginInstead', 'Already have an account? Sign in')}
                  </Button>
                ) : (
                  <Button mode="text" onPress={enterSignupMode} disabled={submitting} style={{ alignSelf: 'center' }}>
                    {t('public.items.checkoutDialog.signupInstead', 'New here? Create an account')}
                  </Button>
                )}
                <View style={styles.actionsRow}>
                  <Button onPress={handleCancel} disabled={submitting}>
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => void handleContinue()}
                    loading={submitting}
                    disabled={!canSubmit}
                  >
                    {t('public.items.checkoutDialog.continue', 'Continue')}
                  </Button>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  fullscreen: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  thumb: { width: 56, height: 56, borderRadius: 8 },
  detailsActions: { alignSelf: 'stretch' },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  resolverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  blockerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
});

export const PublicItemCheckoutSheet = observer(PublicItemCheckoutSheetComponent);
