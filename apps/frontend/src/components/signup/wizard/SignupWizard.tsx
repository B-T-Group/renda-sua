import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { isValidPhoneNumber } from 'libphonenumber-js';
import React, { useCallback, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../../hooks/useApiClient';
import { useAgentReferralLookup } from '../../../hooks/useAgentReferralLookup';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import {
  isAfricanMarketCountry,
  isSignupCountryCode,
} from '../../../constants/marketCountries';
import { getMetaBrowserContext } from '../../../utils/metaBrowserIds';
import LoginMethodDialog from '../../auth/LoginMethodDialog';
import LaunchPromoCongrats, {
  LaunchPromoCongratsData,
} from '../../business/LaunchPromoCongrats';
import Logo from '../../common/Logo';
import SignupAccountCreatedAnimation from '../../onboarding/SignupAccountCreatedAnimation';
import { buildSignupPayload } from './buildSignupPayload';
import { clearSignupDraft } from './useSignupDraft';
import { SignupWizardUiProvider } from './SignupWizardUiContext';
import { StepHost } from './StepHost';
import type { CountryOnboardingUi } from './types';
import { legacyUserTypeFromPersonas } from './types';
import { useSignupWizard } from './useSignupWizard';
import { WizardChrome } from './WizardChrome';

interface SignupStartUser {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  user_type_id: string;
  phone_number: string | null;
  email_verified: boolean;
}

export const SignupWizard: React.FC = () => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithRedirect } = useAuth0();
  const apiClient = useApiClient();
  const { countries: rawCountries, loading: countriesLoading } =
    useSupportedCountries();

  const countries: CountryOnboardingUi[] = useMemo(
    () =>
      rawCountries.map((c) => ({
        code: c.code,
        name: c.name,
        currencyCode: c.currencyCode,
        signupEnabled: c.signupEnabled ?? isSignupCountryCode(c.code),
        postalCodeRequired:
          c.postalCodeRequired ?? ['US', 'CA'].includes(c.code),
        verificationFlow: c.verificationFlow ?? 'national_id',
        supportedPaymentMethods: c.supportedPaymentMethods || [],
      })),
    [rawCountries]
  );

  const signupCountryCodes = useMemo(
    () => countries.filter((c) => c.signupEnabled).map((c) => c.code),
    [countries]
  );

  const wizard = useSignupWizard({
    intentParam: search.get('intent'),
    countries,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [postSignupEmail, setPostSignupEmail] = useState<string | null>(null);
  const [pendingOwnEmail, setPendingOwnEmail] = useState<string | null>(null);
  const [postSignupPhone, setPostSignupPhone] = useState<string | null>(null);
  const [launchPromo, setLaunchPromo] =
    useState<LaunchPromoCongratsData | null>(() => {
      try {
        const raw = sessionStorage.getItem('pendingSignupLaunchPromo');
        if (!raw) return null;
        return JSON.parse(raw) as LaunchPromoCongratsData;
      } catch {
        return null;
      }
    });
  const [verifyRedirectLoading, setVerifyRedirectLoading] = useState(false);
  const [emailTakenConflict, setEmailTakenConflict] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  /** True only after user taps “Wrong email/phone?” on the post-create screen. */
  const [editingPendingContact, setEditingPendingContact] = useState(false);

  const referralCode = wizard.form.watch('business.referralAgentCode') || '';
  const {
    result: referralLookup,
    loading: referralLookupLoading,
    error: referralLookupError,
  } = useAgentReferralLookup(referralCode);

  const contactEmail =
    (wizard.form.watch('contact.email') || '').trim().toLowerCase();
  const ownPendingEmail = (pendingOwnEmail || '').trim().toLowerCase();
  const emailTakenByOther =
    emailTaken && (!ownPendingEmail || contactEmail !== ownPendingEmail);
  const contactEmailTaken =
    wizard.activeStepId === 'contact' && emailTakenByOther;

  const personas = wizard.form.watch('personas') || [];
  const primaryVerifyPersona = legacyUserTypeFromPersonas(personas);

  const redirectToAuthAfterSignup = useCallback(
    async (loginHint: string, connection: 'email' | 'sms') => {
      try {
        await loginWithRedirect({
          authorizationParams: {
            login_hint: loginHint,
            connection,
            screen_hint: 'signup',
          },
          appState: { returnTo: '/app' },
        });
      } catch (redirectErr: any) {
        console.error('loginWithRedirect failed:', redirectErr);
        if (connection === 'sms' && postSignupEmail) {
          try {
            await loginWithRedirect({
              authorizationParams: {
                login_hint: postSignupEmail,
                connection: 'email',
                screen_hint: 'signup',
              },
              appState: { returnTo: '/app' },
            });
            return;
          } catch (emailRedirectErr: any) {
            console.error('email loginWithRedirect failed:', emailRedirectErr);
          }
        }
        if (connection === 'email' || postSignupEmail) {
          navigate('/auth/otp?flow=signup');
          return;
        }
        setError(
          t(
            'signupPage.phoneAuthUnavailable',
            'Phone verification is currently unavailable. Please try again or contact support.'
          )
        );
      }
    },
    [loginWithRedirect, navigate, t, postSignupEmail]
  );

  const handleVerifyEmailContinue = useCallback(async () => {
    const useSms = Boolean(postSignupPhone);
    const hint = useSms ? postSignupPhone : postSignupEmail;
    if (!hint) return;
    setVerifyRedirectLoading(true);
    try {
      await redirectToAuthAfterSignup(hint, useSms ? 'sms' : 'email');
    } finally {
      setVerifyRedirectLoading(false);
    }
  }, [postSignupEmail, postSignupPhone, redirectToAuthAfterSignup]);

  const persistPendingSignupSession = (
    user: SignupStartUser,
    values: ReturnType<typeof wizard.form.getValues>
  ) => {
    const emailNormalized = (user.email || values.contact.email || '')
      .trim()
      .toLowerCase();
    const phoneNormalized = (user.phone_number || values.contact.phone || '').trim();
    const country = (values.country || '').toUpperCase();
    const useSms =
      Boolean(phoneNormalized) &&
      isValidPhoneNumber(phoneNormalized) &&
      isAfricanMarketCountry(country);
    sessionStorage.setItem('pendingSignupUserId', user.id);
    sessionStorage.setItem('pendingSignupEmail', emailNormalized);
    if (useSms) {
      sessionStorage.setItem('pendingSignupPhone', phoneNormalized);
    } else {
      sessionStorage.removeItem('pendingSignupPhone');
    }
    setPostSignupEmail(emailNormalized || null);
    setPendingOwnEmail(emailNormalized || pendingOwnEmail);
    setPostSignupPhone(useSms ? phoneNormalized : null);
  };

  const updatePendingContact = async (
    values: ReturnType<typeof wizard.form.getValues>
  ) => {
    const payload = buildSignupPayload(values);
    const pendingUserId = sessionStorage.getItem('pendingSignupUserId');
    if (!pendingUserId) {
      throw new Error('Missing pending signup user');
    }
    const { data } = await apiClient.post<{
      success: boolean;
      user: SignupStartUser;
    }>('/auth/signup/update-contact', {
      user_id: pendingUserId,
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email ?? null,
      phone_number: payload.phone_number ?? null,
    });
    return data.user;
  };

  const startPendingSignup = async (
    values: ReturnType<typeof wizard.form.getValues>
  ) => {
    const payload = buildSignupPayload(values);
    const { data } = await apiClient.post<{
      success: boolean;
      user: SignupStartUser;
      launchPromo?: LaunchPromoCongratsData | null;
    }>('/auth/signup/start', {
      ...payload,
      ...getMetaBrowserContext(),
      eventSourceUrl:
        typeof window !== 'undefined' ? window.location.href : undefined,
    });
    if (data.launchPromo) {
      setLaunchPromo(data.launchPromo);
      try {
        sessionStorage.setItem(
          'pendingSignupLaunchPromo',
          JSON.stringify(data.launchPromo)
        );
      } catch {
        // ignore storage failures
      }
    } else {
      setLaunchPromo(null);
      sessionStorage.removeItem('pendingSignupLaunchPromo');
    }
    return data.user;
  };

  const handleChangeContact = () => {
    setError(null);
    setEmailTakenConflict(false);
    setPostSignupEmail(null);
    setPostSignupPhone(null);
    setEditingPendingContact(true);
    wizard.setActiveStepId('contact');
  };

  const savePendingContactAndContinue = async () => {
    setSaving(true);
    setError(null);
    setEmailTakenConflict(false);
    try {
      const contactOk = await wizard.form.trigger([
        'contact.firstName',
        'contact.lastName',
        'contact.email',
        'contact.phone',
      ]);
      if (!contactOk) return;
      const values = wizard.form.getValues();
      const user = await updatePendingContact(values);
      persistPendingSignupSession(user, values);
      setEditingPendingContact(false);
    } catch (err: any) {
      const apiError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t(
          'signupPage.createAccountError',
          'Unable to create account at this time.'
        );
      if (
        err?.response?.status === 409 ||
        String(apiError).toLowerCase().includes('already taken')
      ) {
        setEmailTakenConflict(true);
        setError(
          t(
            'signupPage.emailTakenLogin',
            'This email is already registered. Log in instead.'
          )
        );
      } else {
        setError(apiError);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleWizardNext = async () => {
    if (editingPendingContact && wizard.activeStepId === 'contact') {
      await savePendingContactAndContinue();
      return;
    }
    if (wizard.activeStepId === 'contact' && emailTakenByOther) return;
    await wizard.goNext();
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    setEmailTakenConflict(false);
    try {
      const values = wizard.form.getValues();
      const hasBusiness = values.personas.includes('business');
      const needsReferralValidation =
        hasBusiness || values.personas.includes('agent');
      const trimmedReferral = values.business.referralAgentCode.trim();

      if (hasBusiness && wizard.postalCodeRequired) {
        const postal = values.storeLocation.postalCode.trim();
        if (!postal) {
          wizard.form.setError('storeLocation.postalCode', {
            message: 'Required',
          });
          setSaving(false);
          return;
        }
      }

      if (
        needsReferralValidation &&
        trimmedReferral.length > 0 &&
        trimmedReferral.length !== 6
      ) {
        setError(
          t(
            'referrals.invalidCodeLength',
            'Referral code must be 6 characters.'
          )
        );
        setSaving(false);
        return;
      }
      if (needsReferralValidation && trimmedReferral.length === 6) {
        if (referralLookupLoading) {
          setError(
            t(
              'agent.referrals.lookupLoading',
              'Looking up agent... Please wait a moment and try again.'
            )
          );
          setSaving(false);
          return;
        }
        if (
          !referralLookup ||
          referralLookupError ||
          referralLookup.agentCode !== trimmedReferral.toUpperCase()
        ) {
          setError(
            t('agent.referrals.lookupError', 'No agent found for this code')
          );
          setSaving(false);
          return;
        }
      }

      const valid = await wizard.form.trigger();
      if (!valid) {
        setSaving(false);
        return;
      }

      const user = editingPendingContact
        ? await updatePendingContact(values)
        : await startPendingSignup(values);
      persistPendingSignupSession(user, values);
      setEditingPendingContact(false);
      clearSignupDraft();
    } catch (err: any) {
      const apiError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('signupPage.createAccountError', 'Unable to create account at this time.');
      if (
        err?.response?.status === 409 ||
        String(apiError).toLowerCase().includes('already taken')
      ) {
        setEmailTakenConflict(true);
        setError(
          t(
            'signupPage.emailTakenLogin',
            'This email is already registered. Log in instead.'
          )
        );
      } else {
        setError(apiError);
      }
    } finally {
      setSaving(false);
    }
  };

  const showAccountCreated = Boolean(postSignupEmail);
  const subtitle = showAccountCreated
    ? null
    : t(wizard.activeStep.subtitleKey, wizard.activeStep.subtitleDefault);

  return (
    <>
      <Container
        maxWidth="sm"
        sx={{ py: { xs: 2, sm: 5 }, px: { xs: 2, sm: 3 } }}
      >
        <Paper
          elevation={isNarrow ? 0 : 1}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: 0,
            border: { xs: `1px solid ${theme.palette.divider}`, sm: 'none' },
            overflow: 'visible',
            '& .MuiOutlinedInput-root': { borderRadius: 0 },
            '& .MuiButton-root': { borderRadius: 0 },
            '& .MuiCard-root': { borderRadius: 0 },
            '& .MuiAlert-root': { borderRadius: 0 },
          }}
        >
          <Stack spacing={{ xs: 2, sm: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 0.5, sm: 0 } }}>
              <Logo variant="default" size={isNarrow ? 'small' : 'medium'} />
            </Box>

            {showAccountCreated ? (
              <>
                <Typography
                  variant={isNarrow ? 'h5' : 'h4'}
                  component="h1"
                  sx={{ fontWeight: 700, lineHeight: 1.25, textAlign: 'center' }}
                >
                  {t(
                    'signupPage.accountCreatedTitle',
                    'Account successfully created'
                  )}
                </Typography>
                {launchPromo ? (
                  <LaunchPromoCongrats promo={launchPromo} />
                ) : (
                  <Stack
                    spacing={2}
                    alignItems="center"
                    sx={{ py: { xs: 0.5, sm: 1 } }}
                    role="status"
                    aria-live="polite"
                  >
                    <SignupAccountCreatedAnimation />
                  </Stack>
                )}
                <Typography
                  color="text.secondary"
                  variant="body2"
                  component="div"
                  sx={{
                    lineHeight: 1.55,
                    fontSize: { xs: '0.9375rem', sm: '1rem' },
                    textAlign: 'center',
                    '& strong': { color: 'text.primary', fontWeight: 700 },
                  }}
                >
                  {postSignupPhone ? (
                    <Trans
                      i18nKey="signupPage.accountCreatedBodyPhone"
                      defaults="We will send a verification code by SMS to <bold>{{phone}}</bold>."
                      values={{ phone: postSignupPhone }}
                      components={{ bold: <strong /> }}
                    />
                  ) : (
                    <Trans
                      i18nKey="signupPage.accountCreatedBody"
                      values={{ email: postSignupEmail ?? '' }}
                      components={{ bold: <strong /> }}
                    />
                  )}
                </Typography>
                <Button
                  color="inherit"
                  onClick={handleChangeContact}
                  disabled={saving || verifyRedirectLoading}
                  sx={{
                    alignSelf: 'center',
                    textTransform: 'none',
                    fontWeight: 600,
                  }}
                >
                  {postSignupPhone
                    ? t(
                        'signupPage.changePhone',
                        'Wrong phone number? Change it'
                      )
                    : t(
                        'signupPage.changeEmail',
                        'Wrong email? Change it'
                      )}
                </Button>
              </>
            ) : (
              <>
                <Typography
                  variant={isNarrow ? 'h5' : 'h4'}
                  component="h1"
                  sx={{ fontWeight: 700, lineHeight: 1.25, textAlign: 'center' }}
                >
                  {t('signupPage.title', 'Create your account')}
                </Typography>
                {subtitle && (
                  <Typography
                    color="text.secondary"
                    variant="body2"
                    sx={{
                      lineHeight: 1.5,
                      fontSize: { xs: '0.9375rem', sm: '1rem' },
                      textAlign: 'center',
                    }}
                  >
                    {subtitle}
                  </Typography>
                )}
              </>
            )}

            {error && (
              <Alert
                severity="error"
                sx={{ borderRadius: 0 }}
                action={
                  emailTakenConflict ? (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={() => setLoginDialogOpen(true)}
                    >
                      {t('signupPage.logIn', 'Log in')}
                    </Button>
                  ) : undefined
                }
              >
                {error}
              </Alert>
            )}

            <SignupWizardUiProvider
              value={{
                countries,
                countriesLoading,
                postalCodeRequired: wizard.postalCodeRequired,
                signupCountryCodes,
                onLoginInstead: () => setLoginDialogOpen(true),
                emailTaken,
                setEmailTaken,
                ownSignupEmail: pendingOwnEmail,
              }}
            >
              <FormProvider {...wizard.form}>
                <WizardChrome
                  steps={wizard.steps}
                  activeIndex={wizard.activeIndex}
                  isFirst={wizard.isFirst}
                  isLast={wizard.isLast}
                  saving={saving}
                  nextDisabled={contactEmailTaken}
                  onBack={wizard.goBack}
                  onNext={() => void handleWizardNext()}
                  onCreate={() => void handleCreate()}
                  hideProgress={showAccountCreated}
                  primaryOnly={
                    showAccountCreated
                      ? {
                          label: t(
                            `signupPage.verifyNext.${primaryVerifyPersona}`,
                            primaryVerifyPersona === 'agent'
                              ? 'Verify to see nearby runs'
                              : primaryVerifyPersona === 'business'
                                ? 'Verify to set up your store'
                                : 'Verify to start shopping'
                          ),
                          onClick: () => void handleVerifyEmailContinue(),
                          loading: verifyRedirectLoading,
                        }
                      : undefined
                  }
                >
                  {!showAccountCreated && <StepHost step={wizard.activeStep} />}
                </WizardChrome>
              </FormProvider>
            </SignupWizardUiProvider>

            {!showAccountCreated && (
              <Button
                color="inherit"
                onClick={() => setLoginDialogOpen(true)}
                disabled={saving}
                sx={{
                  alignSelf: { xs: 'center', sm: 'flex-start' },
                  textTransform: 'none',
                  fontWeight: 600,
                }}
              >
                {t(
                  'signupPage.alreadyHaveAccount',
                  'Already have an account? Log in'
                )}
              </Button>
            )}
          </Stack>
        </Paper>
      </Container>
      <LoginMethodDialog
        open={loginDialogOpen}
        onClose={() => setLoginDialogOpen(false)}
      />
    </>
  );
};
