import { useTranslation } from 'react-i18next';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import type { CountryCode } from 'libphonenumber-js';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import Logo from '../../components/Logo';
import { ContactStep } from '../../components/signup/steps/ContactStep';
import { CountryStep } from '../../components/signup/steps/CountryStep';
import { PersonasStep } from '../../components/signup/steps/PersonasStep';
import { AgentFocusStep } from '../../components/signup/steps/AgentFocusStep';
import { ReviewStep } from '../../components/signup/steps/ReviewStep';
import { StoreLocationStep } from '../../components/signup/steps/StoreLocationStep';
import { buildSignupPayload } from '../../components/signup/wizard/buildSignupPayload';
import {
  loadSignupDraft,
  useSignupDraft,
} from '../../components/signup/wizard/useSignupDraft';
import { useSignupWizard } from '../../components/signup/wizard/useSignupWizard';
import {
  createDefaultSignupValues,
  emptyStoreLocation,
  isStoreLocationComplete,
  legacyUserTypeFromPersonas,
  type SignupWizardValues,
  type WizardStepId,
} from '../../components/signup/wizard/types';
import type { PickerRow } from '../../components/forms/SearchablePickerModal';
import { useTheme } from '../../contexts/ThemeContext';
import { ConfirmActionDialog } from '../../components/dialogs/ConfirmActionDialog';
import { useSignupEmailAvailability, isValidEmailFormat } from '../../hooks/useSignupEmailAvailability';
import { useSignupExistingAccountLogin } from '../../hooks/useSignupExistingAccountLogin';
import { useAgentReferralLookup } from '../../hooks/useAgentReferralLookup';
import type { AgentReferralLookupResult } from '../../hooks/useAgentReferralLookup';
import {
  countrySupportsStripe,
  filterSignupEnabledCountries,
  useSupportedCountries,
} from '../../hooks/useSupportedCountries';
import {
  keyboardAwareScrollProps,
} from '../../hooks/useKeyboardVerticalOffset';
import type { SignupScreenProps } from '../../navigation/types';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import { isAfricanMarketCountry } from '../../constants/marketCountries';
import {
  getPhoneAvailability,
  postSignupStart,
  type SignupStartPersona,
} from '../../services/publicAuthApi';
import StorageService from '../../services/storage/StorageService';
import { useStore } from '../../stores/RootStore';
import { getDeviceDefaultCountryCode } from '../../utils/deviceDefaultCountry';
import { nationalDigitsToE164 } from '../../utils/phoneLoginUsername';
import { getAuthFlowErrorKey } from '../../utils/authErrorI18nKey';
import { trackSignupStarted } from '../../utils/ftueAnalytics';

const PROGRESS_BAR_HEIGHT = 6;

function SignupStepProgressBar({
  progress,
  trackColor,
  fillColor,
  borderRadius,
  marginBottom,
}: {
  progress: number;
  trackColor: string;
  fillColor: string;
  borderRadius: number;
  marginBottom: number;
}) {
  const pct = Math.min(1, Math.max(0, progress));
  return (
    <View
      style={{
        height: PROGRESS_BAR_HEIGHT,
        width: '100%',
        marginBottom,
        borderRadius,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: PROGRESS_BAR_HEIGHT,
          width: `${pct * 100}%`,
          backgroundColor: fillColor,
          borderRadius,
        }}
      />
    </View>
  );
}

function SignupScreen({ navigation, route }: SignupScreenProps) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useStore();
  const defaultCountry = useMemo(() => getDeviceDefaultCountryCode(), []);
  const preselectedPersona = route.params?.preselectedPersona;
  const signupSource = route.params?.source ?? 'organic';

  const [values, setValues] = useState<SignupWizardValues>(() => {
    const base = createDefaultSignupValues(defaultCountry);
    if (preselectedPersona) {
      return { ...base, personas: [preselectedPersona] };
    }
    return base;
  });
  const [draftReady, setDraftReady] = useState(false);
  const [restoredStepId, setRestoredStepId] = useState<WizardStepId | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { emailTaken, checkingEmail } = useSignupEmailAvailability(values.contact.email);
  const existingAccountLogin = useSignupExistingAccountLogin(
    navigation,
    values.contact.email
  );
  const { countries: supportedCountries, loading: countriesLoading } =
    useSupportedCountries();
  const {
    result: referralLookup,
    loading: referralLookupLoading,
    error: referralLookupError,
  } = useAgentReferralLookup(values.business.referralAgentCode);
  const [verifiedReferral, setVerifiedReferral] =
    useState<AgentReferralLookupResult | null>(null);
  const effectiveReferralLookup =
    referralLookup ??
    (referralLookupLoading &&
    verifiedReferral &&
    verifiedReferral.agentCode.toUpperCase() ===
      values.business.referralAgentCode.trim().toUpperCase()
      ? verifiedReferral
      : null);

  const {
    steps,
    stepIndex,
    activeStepId,
    currentStep,
    totalSteps,
    isFirst,
    isLast,
    goNext,
    goBack,
    goToStepId,
    setStepIndex,
  } = useSignupWizard(values);

  useEffect(() => {
    let active = true;
    void loadSignupDraft().then((draft) => {
      if (!active) return;
      if (draft?.values) {
        setValues(
          preselectedPersona
            ? { ...draft.values, personas: [preselectedPersona] }
            : draft.values
        );
        setRestoredStepId(draft.activeStepId);
      }
      setDraftReady(true);
    });
    return () => {
      active = false;
    };
  }, [preselectedPersona]);

  useEffect(() => {
    if (!preselectedPersona) return;
    setValues((prev) => {
      if (prev.personas.length === 1 && prev.personas[0] === preselectedPersona) {
        return prev;
      }
      return { ...prev, personas: [preselectedPersona] };
    });
  }, [preselectedPersona]);

  useEffect(() => {
    if (!restoredStepId) return;
    const idx = steps.findIndex((s) => s.id === restoredStepId);
    if (idx >= 0) setStepIndex(idx);
    setRestoredStepId(null);
  }, [restoredStepId, steps, setStepIndex]);

  const bootstrapReady = draftReady && !countriesLoading;
  useSignupDraft(values, activeStepId, bootstrapReady);

  const supportsStripe = useMemo(
    () => countrySupportsStripe(supportedCountries, values.country),
    [supportedCountries, values.country]
  );

  const postalCodeRequired = useMemo(() => {
    const match = supportedCountries.find(
      (c) => c.code?.toUpperCase() === values.country.toUpperCase()
    );
    return !!match?.postalCodeRequired;
  }, [supportedCountries, values.country]);

  const countryRows = useMemo<PickerRow[]>(
    () =>
      filterSignupEnabledCountries(supportedCountries)
        .map((c) => ({ id: c.code.toUpperCase(), title: c.name }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    [supportedCountries]
  );

  const countryLabel = useMemo(
    () =>
      countryRows.find((r) => r.id === values.country)?.title ||
      values.country ||
      t('addresses.pickCountry', 'Select country'),
    [countryRows, values.country, t]
  );

  const applyCountry = useCallback((code: string) => {
    const iso = code.toUpperCase();
    setValues((prev) => {
      if (prev.country === iso) {
        return {
          ...prev,
          contact: {
            ...prev.contact,
            phoneCountry: iso as CountryCode,
          },
        };
      }
      return {
        ...prev,
        country: iso,
        contact: {
          ...prev.contact,
          phoneCountry: iso as CountryCode,
          phoneNationalDigits: '',
        },
        storeLocation: emptyStoreLocation(iso),
      };
    });
    setCountryPickerOpen(false);
  }, []);

  useEffect(() => {
    if (!draftReady || countryRows.length === 0) return;
    if (countryRows.some((r) => r.id === values.country)) return;
    applyCountry(countryRows[0].id);
  }, [draftReady, countryRows, values.country, applyCountry]);

  const phoneE164 = useMemo(
    () =>
      nationalDigitsToE164(
        values.country as CountryCode,
        values.contact.phoneNationalDigits
      ),
    [values.country, values.contact.phoneNationalDigits]
  );
  const phoneValid = Boolean(phoneE164 && isValidPhoneNumber(phoneE164));
  const phoneEntered = values.contact.phoneNationalDigits.trim().length > 0;
  const phoneOkOnContact = supportsStripe ? !phoneEntered || phoneValid : phoneValid;

  const canAdvanceFromCountry = useMemo(() => {
    if (countriesLoading || countryRows.length === 0) return false;
    if (!values.country.trim()) return false;
    return countryRows.some((r) => r.id === values.country);
  }, [countriesLoading, values.country, countryRows]);

  const canAdvanceFromContact = useMemo(() => {
    if (!values.contact.firstName.trim() || !values.contact.lastName.trim()) return false;
    if (!isValidEmailFormat(values.contact.email) || emailTaken || checkingEmail) return false;
    return phoneOkOnContact;
  }, [values.contact, emailTaken, checkingEmail, phoneOkOnContact]);

  const canAdvanceFromPersonas = useMemo(() => {
    if (values.personas.length === 0) return false;
    if (values.personas.includes('business') && !values.business.name.trim()) return false;
    return true;
  }, [values.personas, values.business.name]);

  const canAdvanceFromAgentFocus = Boolean(values.agentFocus);

  const canAdvanceFromStore = useMemo(
    () => isStoreLocationComplete(values.storeLocation, postalCodeRequired),
    [values.storeLocation, postalCodeRequired]
  );

  const patchContact = useCallback(
    (partial: Partial<SignupWizardValues['contact']>) => {
      setValues((prev) => ({ ...prev, contact: { ...prev.contact, ...partial } }));
    },
    []
  );

  const togglePersona = useCallback((p: SignupStartPersona) => {
    setValues((prev) => {
      // Signup allows exactly one persona; additional roles can be enrolled later.
      if (prev.personas.length === 1 && prev.personas[0] === p) return prev;
      return { ...prev, personas: [p] };
    });
  }, []);

  const handleBack = useCallback(() => {
    setLocalError(null);
    goBack();
  }, [goBack]);

  const handleLoginInstead = useCallback(() => {
    void existingAccountLogin.loginWithTakenEmail().then((err) => {
      if (err) setLocalError(t(getAuthFlowErrorKey(err)));
    });
  }, [existingAccountLogin.loginWithTakenEmail, t]);

  const handleNext = useCallback(async () => {
    setLocalError(null);
    if (activeStepId === 'country') {
      if (!canAdvanceFromCountry) return;
      goNext();
      return;
    }
    if (activeStepId === 'contact') {
      if (!canAdvanceFromContact) {
        if (!supportsStripe && !phoneValid) {
          setLocalError(
            t(
              'auth.signupFlow.phoneRequiredForCountry',
              'A phone number is required for this country.'
            )
          );
        }
        return;
      }
      if (phoneE164) {
        try {
          const { taken } = await getPhoneAvailability(phoneE164);
          if (taken) {
            setLocalError(
              t('auth.signupFlow.phoneTaken', 'This phone number is already registered.')
            );
            existingAccountLogin.offerPhoneLogin(phoneE164);
            return;
          }
        } catch (e: unknown) {
          setLocalError(
            e instanceof Error ? e.message : t('auth.errors.network', 'Connection problem.')
          );
          return;
        }
      }
      goNext();
      return;
    }
    if (activeStepId === 'personas') {
      if (!canAdvanceFromPersonas) return;
      goNext();
      return;
    }
    if (activeStepId === 'agentFocus') {
      if (!canAdvanceFromAgentFocus) return;
      goNext();
      return;
    }
    if (activeStepId === 'storeLocation') {
      if (!canAdvanceFromStore) {
        setLocalError(
          t(
            'auth.signupFlow.addressRequired',
            'Please complete your address to continue.'
          )
        );
        return;
      }
      goNext();
    }
  }, [
    activeStepId,
    canAdvanceFromContact,
    canAdvanceFromPersonas,
    canAdvanceFromAgentFocus,
    canAdvanceFromCountry,
    canAdvanceFromStore,
    phoneE164,
    phoneValid,
    supportsStripe,
    goNext,
    existingAccountLogin.offerPhoneLogin,
    t,
  ]);

  const handleCreateAccount = useCallback(async () => {
    if (!canAdvanceFromContact || !canAdvanceFromPersonas || !canAdvanceFromCountry) return;
    if (values.personas.includes('business') && !canAdvanceFromStore) return;
    if (!phoneE164 && !supportsStripe) return;

    setSubmitting(true);
    setLocalError(null);
    auth.clearError();

    const trimmedReferral = values.business.referralAgentCode.trim();
    const needsReferralValidation =
      values.personas.includes('business') ||
      values.personas.includes('agent');
    if (needsReferralValidation && trimmedReferral.length > 0) {
      if (trimmedReferral.length !== 6) {
        setSubmitting(false);
        setLocalError(
          t('referrals.invalidCodeLength', 'Referral code must be 6 characters.')
        );
        return;
      }
      if (referralLookupLoading && !effectiveReferralLookup) {
        setSubmitting(false);
        setLocalError(
          t(
            'agent.referrals.lookupLoading',
            'Looking up agent... Please wait a moment and try again.'
          )
        );
        return;
      }
      if (
        !effectiveReferralLookup ||
        (referralLookupError && !effectiveReferralLookup) ||
        effectiveReferralLookup.agentCode !== trimmedReferral.toUpperCase()
      ) {
        setSubmitting(false);
        setLocalError(t('agent.referrals.lookupError', 'No agent found for this code'));
        return;
      }
    }

    const payload = buildSignupPayload({ values, phoneE164 });
    const primaryPersona = legacyUserTypeFromPersonas(values.personas);
    const trimmedEmail = values.contact.email.trim().toLowerCase();
    const hasPhone = Boolean(phoneE164);
    const useSms = hasPhone && isAfricanMarketCountry(values.country);

    try {
      trackSignupStarted({
        source: signupSource,
        persona: primaryPersona,
      });
      const res = await postSignupStart({
        ...payload,
        verification_channel: useSms ? 'sms' : 'email',
      });
      await StorageService.setString(
        STORAGE_KEYS.pendingSignupAttemptId,
        res.attemptId
      );
      auth.setSignupWelcomePersona(primaryPersona);
      setSubmitting(false);
      if (useSms && phoneE164) {
        navigation.navigate('OtpVerification', {
          channel: 'phone',
          phoneE164,
          flow: 'signup',
          signupSource,
          attemptId: res.attemptId,
        });
      } else {
        navigation.navigate('OtpVerification', {
          channel: 'email',
          email: trimmedEmail,
          flow: 'signup',
          signupSource,
          attemptId: res.attemptId,
        });
      }
    } catch (e: unknown) {
      setSubmitting(false);
      const msg = e instanceof Error ? e.message : '';
      setLocalError(
        msg ||
          t(
            'auth.signupFlow.createError',
            'Unable to start verification at this time.'
          )
      );
    }
  }, [
    canAdvanceFromContact,
    canAdvanceFromPersonas,
    canAdvanceFromCountry,
    canAdvanceFromStore,
    values,
    phoneE164,
    supportsStripe,
    signupSource,
    auth,
    referralLookup,
    referralLookupLoading,
    referralLookupError,
    effectiveReferralLookup,
    navigation,
    t,
  ]);


  const stepTitle = currentStep
    ? t(currentStep.labelKey, currentStep.labelDefault)
    : '';
  const stepSubtitle = currentStep
    ? t(currentStep.subtitleKey, currentStep.subtitleDefault)
    : '';
  const stepProgress = (stepIndex + 1) / Math.max(totalSteps, 1);

  const nextDisabled =
    submitting ||
    (activeStepId === 'contact' && !canAdvanceFromContact) ||
    (activeStepId === 'personas' && !canAdvanceFromPersonas) ||
    (activeStepId === 'agentFocus' && !canAdvanceFromAgentFocus) ||
    (activeStepId === 'country' && !canAdvanceFromCountry) ||
    (activeStepId === 'storeLocation' && !canAdvanceFromStore);

  const footerPad = Math.max(insets.bottom, spacing.sm) + spacing.sm;
  const scrollContentPad = spacing.xl + 120;

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    const tabNav = navigation.getParent();
    if (tabNav) {
      tabNav.navigate('GuestBrowse' as never);
      return;
    }
  }, [navigation]);

  return (
    <View style={[styles.container, { backgroundColor: colors.pageBackground }]}>
      <View
        style={[
          styles.topBar,
          {
            paddingTop: insets.top,
            backgroundColor: colors.pageBackground,
            borderBottomColor: colors.divider,
          },
        ]}
      >
        <IconButton
          icon="close"
          mode="contained-tonal"
          onPress={goHome}
          accessibilityLabel={t('auth.signupFlow.browseHome', 'Browse items')}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          {...keyboardAwareScrollProps}
          automaticallyAdjustKeyboardInsets={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: scrollContentPad + footerPad,
              paddingTop: spacing.lg,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandRow}>
            <Logo variant="compact" />
          </View>
          <Text variant="headlineSmall" style={[styles.title, { color: colors.text.primary }]}>
            {t('auth.signup', 'Sign up')}
          </Text>
          <Text variant="bodyMedium" style={[styles.subtitle, { color: colors.text.secondary }]}>
            {t('auth.signupFlow.heroSubtitle', 'Create your account in a few steps')}
          </Text>

          <Pressable
            onPress={() => navigation.replace('Login')}
            disabled={submitting}
            style={styles.loginLink}
            accessibilityRole="button"
          >
            <Text variant="bodyMedium" style={{ color: colors.primary.main }}>
              {t('auth.hasAccount', 'Already have an account?')}{' '}
              <Text variant="bodyMedium" style={{ color: colors.primary.main, fontWeight: '700' }}>
                {t('auth.login', 'Log in')}
              </Text>
            </Text>
          </Pressable>

          <Text variant="labelLarge" style={{ color: colors.primary.main, marginBottom: spacing.xs }}>
            {t('auth.signupFlow.stepProgress', 'Step {{current}} of {{total}}', {
              current: stepIndex + 1,
              total: totalSteps,
            })}
          </Text>
          <SignupStepProgressBar
            progress={stepProgress}
            trackColor={colors.divider}
            fillColor={colors.primary.main}
            borderRadius={borderRadius.sm}
            marginBottom={spacing.md}
          />
          <Text variant="titleMedium" style={{ color: colors.text.primary, marginBottom: spacing.xs }}>
            {stepTitle}
          </Text>
          <Text variant="bodyMedium" style={{ color: colors.text.secondary, marginBottom: spacing.lg }}>
            {stepSubtitle}
          </Text>

          {!bootstrapReady ? (
            <ActivityIndicator style={{ marginVertical: spacing.xl }} />
          ) : (
            <>
              {activeStepId === 'country' ? (
                <CountryStep
                  country={values.country}
                  countryLabel={countryLabel}
                  countryRows={countryRows}
                  pickerOpen={countryPickerOpen}
                  disabled={submitting}
                  onOpenPicker={() => setCountryPickerOpen(true)}
                  onClosePicker={() => setCountryPickerOpen(false)}
                  onSelectCountry={applyCountry}
                />
              ) : null}

              {activeStepId === 'contact' ? (
                <ContactStep
                  firstName={values.contact.firstName}
                  lastName={values.contact.lastName}
                  email={values.contact.email}
                  phoneCountry={values.country as CountryCode}
                  phoneNationalDigits={values.contact.phoneNationalDigits}
                  emailTaken={emailTaken}
                  checkingEmail={checkingEmail}
                  disabled={submitting}
                  phoneOptional={supportsStripe}
                  disableCountryPicker
                  onChangeFirstName={(v) => patchContact({ firstName: v })}
                  onChangeLastName={(v) => patchContact({ lastName: v })}
                  onChangeEmail={(v) => patchContact({ email: v })}
                  onChangePhoneCountry={(v) => patchContact({ phoneCountry: v })}
                  onChangePhoneNationalDigits={(v) => patchContact({ phoneNationalDigits: v })}
                  onLoginInstead={handleLoginInstead}
                  loginInsteadBusy={existingAccountLogin.busy}
                />
              ) : null}

              {activeStepId === 'personas' ? (
                <PersonasStep
                  personas={values.personas}
                  businessName={values.business.name}
                  mainInterest={values.business.mainInterest}
                  referralAgentCode={values.business.referralAgentCode}
                  disabled={submitting}
                  onTogglePersona={togglePersona}
                  onChangeBusinessName={(name) =>
                    setValues((prev) => ({ ...prev, business: { ...prev.business, name } }))
                  }
                  onChangeMainInterest={(mainInterest) =>
                    setValues((prev) => ({
                      ...prev,
                      business: { ...prev.business, mainInterest },
                    }))
                  }
                  onChangeReferralAgentCode={(referralAgentCode) =>
                    setValues((prev) => ({
                      ...prev,
                      business: { ...prev.business, referralAgentCode },
                    }))
                  }
                  onVerifiedReferralLookup={setVerifiedReferral}
                />
              ) : null}

              {activeStepId === 'agentFocus' ? (
                <AgentFocusStep
                  value={values.agentFocus}
                  disabled={submitting}
                  onChange={(agentFocus) =>
                    setValues((prev) => ({ ...prev, agentFocus }))
                  }
                />
              ) : null}

              {activeStepId === 'storeLocation' ? (
                <StoreLocationStep
                  value={values.storeLocation}
                  onChange={(storeLocation) => setValues((prev) => ({ ...prev, storeLocation }))}
                  disabled={submitting}
                  postalCodeRequired={postalCodeRequired}
                />
              ) : null}

              {activeStepId === 'review' ? (
                <ReviewStep
                  personas={values.personas}
                  agentFocus={values.agentFocus}
                  businessName={values.business.name}
                  mainInterest={values.business.mainInterest}
                  referralAgentCode={values.business.referralAgentCode}
                  referralLookup={effectiveReferralLookup}
                  firstName={values.contact.firstName}
                  lastName={values.contact.lastName}
                  email={values.contact.email}
                  phoneE164={phoneE164}
                  countryLabel={countryLabel}
                  countryCode={values.country}
                  storeLocation={values.storeLocation}
                  onEditStep={goToStepId}
                />
              ) : null}

              {localError ? (
                <Text style={[styles.err, { color: colors.error.main }]}>{localError}</Text>
              ) : null}
              {auth.error ? (
                <Text style={[styles.err, { color: colors.error.main }]}>{auth.error}</Text>
              ) : null}
            </>
          )}
        </ScrollView>

        {bootstrapReady ? (
          <View
            style={[
              styles.footer,
              {
                paddingBottom: footerPad,
                paddingHorizontal: spacing.lg,
                paddingTop: spacing.sm,
                backgroundColor: colors.pageBackground,
                borderTopColor: colors.divider,
              },
            ]}
          >
            <View style={[styles.navRow, isLast ? styles.navRowStacked : null]}>
              {!isFirst ? (
                <Button
                  mode="outlined"
                  onPress={handleBack}
                  disabled={submitting}
                  style={[
                    styles.navBtn,
                    isLast ? styles.navBtnFull : styles.navBtnHalf,
                  ]}
                  contentStyle={styles.navBtnContent}
                >
                  {t('common.back', 'Back')}
                </Button>
              ) : null}
              {!isLast ? (
                <Button
                  mode="contained"
                  onPress={() => void handleNext()}
                  disabled={nextDisabled}
                  style={[
                    styles.navBtn,
                    isFirst ? styles.navBtnFull : styles.navBtnHalf,
                  ]}
                  contentStyle={styles.navBtnContent}
                >
                  {t('common.next', 'Next')}
                </Button>
              ) : (
                <Button
                  mode="contained"
                  onPress={() => void handleCreateAccount()}
                  disabled={submitting}
                  style={[styles.navBtn, styles.navBtnFull]}
                  contentStyle={styles.navBtnContent}
                  labelStyle={styles.createAccountLabel}
                >
                  {submitting ? (
                    <ActivityIndicator color={colors.primary.contrast} />
                  ) : (
                    t('auth.signupFlow.createAccount', 'Create account')
                  )}
                </Button>
              )}
            </View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <ConfirmActionDialog
        visible={!!existingAccountLogin.prompt}
        title={t('auth.signupFlow.loginInsteadTitle', 'Log in instead?')}
        message={t(
          'auth.signupFlow.loginInsteadPhone',
          'This phone number is already registered. Would you like to log in with it?'
        )}
        cancelLabel={t('auth.signupFlow.loginInsteadNo', 'No')}
        confirmLabel={t('auth.signupFlow.loginInsteadYes', 'Yes')}
        loading={existingAccountLogin.busy}
        onDismiss={existingAccountLogin.dismiss}
        onConfirm={() => {
          void existingAccountLogin.confirm().then((err) => {
            if (err) setLocalError(t(getAuthFlowErrorKey(err)));
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 4,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  scroll: { padding: 24, maxWidth: 480, alignSelf: 'center', width: '100%' },
  brandRow: { alignItems: 'center', marginBottom: 12 },
  title: { textAlign: 'center', fontWeight: '800' },
  subtitle: { textAlign: 'center', marginBottom: 8 },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  err: { marginTop: 12 },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  /** Full-width stack so long create-account copy (e.g. FR) is not truncated. */
  navRowStacked: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  // Use height (not minHeight) so Paper's iOS Surface inner layer flexes to
  // fill the outer layer. minHeight + content width 100% paints two rectangles.
  navBtn: { height: 48 },
  navBtnHalf: { flex: 1 },
  navBtnFull: { alignSelf: 'stretch' },
  navBtnContent: { height: 48 },
  createAccountLabel: {
    fontSize: 15,
    marginVertical: 0,
  },
});


export default observer(SignupScreen);
