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
import React, { useCallback, useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../../hooks/useApiClient';
import { useAgentReferralLookup } from '../../../hooks/useAgentReferralLookup';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import LoginMethodDialog from '../../auth/LoginMethodDialog';
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
  email: string;
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
        signupEnabled: c.signupEnabled ?? ['CM', 'GA', 'US', 'CA'].includes(c.code),
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
  const [verifyRedirectLoading, setVerifyRedirectLoading] = useState(false);
  const [emailTakenConflict, setEmailTakenConflict] = useState(false);

  const referralCode = wizard.form.watch('business.referralAgentCode') || '';
  const {
    result: referralLookup,
    loading: referralLookupLoading,
    error: referralLookupError,
  } = useAgentReferralLookup(referralCode);

  const personas = wizard.form.watch('personas') || [];
  const primaryVerifyPersona = legacyUserTypeFromPersonas(personas);

  const redirectToAuthAfterSignup = useCallback(
    async (emailNormalized: string) => {
      try {
        await loginWithRedirect({
          authorizationParams: {
            login_hint: emailNormalized,
            connection: 'email',
            screen_hint: 'signup',
          },
          appState: { returnTo: '/app' },
        });
      } catch (redirectErr: any) {
        console.error('loginWithRedirect failed:', redirectErr);
        navigate('/auth/otp?flow=signup');
      }
    },
    [loginWithRedirect, navigate]
  );

  const handleVerifyEmailContinue = useCallback(async () => {
    if (!postSignupEmail) return;
    setVerifyRedirectLoading(true);
    try {
      await redirectToAuthAfterSignup(postSignupEmail);
    } finally {
      setVerifyRedirectLoading(false);
    }
  }, [postSignupEmail, redirectToAuthAfterSignup]);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    setEmailTakenConflict(false);
    try {
      const values = wizard.form.getValues();
      const hasBusiness = values.personas.includes('business');
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

      if (hasBusiness && trimmedReferral.length > 0 && trimmedReferral.length !== 6) {
        setError(
          t(
            'business.referrals.invalidCodeLength',
            'Agent referral code must be 6 characters.'
          )
        );
        setSaving(false);
        return;
      }
      if (hasBusiness && trimmedReferral.length === 6) {
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

      const payload = buildSignupPayload(values);
      const { data } = await apiClient.post<{
        success: boolean;
        user: SignupStartUser;
      }>('/auth/signup/start', payload);

      const emailNormalized = data.user.email.trim().toLowerCase();
      sessionStorage.setItem('pendingSignupUserId', data.user.id);
      sessionStorage.setItem('pendingSignupEmail', emailNormalized);
      clearSignupDraft();
      setPostSignupEmail(emailNormalized);
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
                <Stack
                  spacing={2}
                  alignItems="center"
                  sx={{ py: { xs: 0.5, sm: 1 } }}
                  role="status"
                  aria-live="polite"
                >
                  <SignupAccountCreatedAnimation />
                </Stack>
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
                  <Trans
                    i18nKey="signupPage.accountCreatedBody"
                    values={{ email: postSignupEmail ?? '' }}
                    components={{ bold: <strong /> }}
                  />
                </Typography>
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

            {error && !showAccountCreated && (
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
              }}
            >
              <FormProvider {...wizard.form}>
                <WizardChrome
                  steps={wizard.steps}
                  activeIndex={wizard.activeIndex}
                  isFirst={wizard.isFirst}
                  isLast={wizard.isLast}
                  saving={saving}
                  onBack={wizard.goBack}
                  onNext={() => void wizard.goNext()}
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
