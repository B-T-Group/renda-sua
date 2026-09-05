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
import React, { useMemo, useState } from 'react';
import { FormProvider } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApiClient } from '../../../hooks/useApiClient';
import { useAgentReferralLookup } from '../../../hooks/useAgentReferralLookup';
import { useSupportedCountries } from '../../../hooks/useSupportedCountries';
import { isSignupCountryCode } from '../../../constants/marketCountries';
import { getMetaBrowserContext } from '../../../utils/metaBrowserIds';
import LoginMethodDialog from '../../auth/LoginMethodDialog';
import Logo from '../../common/Logo';
import { buildSignupPayload } from './buildSignupPayload';
import { SignupWizardUiProvider } from './SignupWizardUiContext';
import { StepHost } from './StepHost';
import type { CountryOnboardingUi } from './types';
import { useSignupWizard } from './useSignupWizard';
import { WizardChrome } from './WizardChrome';

interface SignupStartAttempt {
  attemptId: string;
  channel: 'email' | 'phone';
  contactHint: string;
  expiresAt: string;
  resendAvailableAt: string;
}

export const SignupWizard: React.FC = () => {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'));
  const { t } = useTranslation();
  const [search] = useSearchParams();
  const navigate = useNavigate();
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
  const [emailTakenConflict, setEmailTakenConflict] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);

  const referralCode = wizard.form.watch('business.referralAgentCode') || '';
  const {
    result: referralLookup,
    loading: referralLookupLoading,
    error: referralLookupError,
  } = useAgentReferralLookup(referralCode);

  const contactEmailTaken =
    wizard.activeStepId === 'contact' && emailTaken;

  const persistSignupAttempt = (
    attempt: SignupStartAttempt,
    values: ReturnType<typeof wizard.form.getValues>
  ) => {
    const emailNormalized = (values.contact.email || '').trim().toLowerCase();
    const phoneNormalized = (values.contact.phone || '').trim();
    sessionStorage.setItem('pendingSignupAttemptId', attempt.attemptId);
    sessionStorage.setItem('pendingSignupEmail', emailNormalized);
    sessionStorage.setItem('pendingSignupOtpExpiresAtMs', String(Date.parse(attempt.expiresAt) || Date.now() + 15 * 60 * 1000));
    sessionStorage.setItem(
      'pendingSignupOtpResendAtMs',
      String(Date.parse(attempt.resendAvailableAt) || Date.now() + 2 * 60 * 1000)
    );
    if (attempt.channel === 'phone' && phoneNormalized) {
      sessionStorage.setItem('pendingSignupPhone', phoneNormalized);
    } else {
      sessionStorage.removeItem('pendingSignupPhone');
    }
    sessionStorage.removeItem('pendingSignupUserId');
    sessionStorage.removeItem('pendingSignupLaunchPromo');
  };

  const startSignupAttempt = async (
    values: ReturnType<typeof wizard.form.getValues>
  ) => {
    const payload = buildSignupPayload(values);
    const { data } = await apiClient.post<
      { success: boolean } & SignupStartAttempt
    >('/auth/signup/start', {
      ...payload,
      ...getMetaBrowserContext(),
      eventSourceUrl:
        typeof window !== 'undefined' ? window.location.href : undefined,
    });
    return data;
  };

  const handleWizardNext = async () => {
    if (wizard.activeStepId === 'contact' && emailTaken) return;
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

      const attempt = await startSignupAttempt(values);
      persistSignupAttempt(attempt, values);
      // Keep draft until OTP succeeds so contact corrections can restart cleanly.
      navigate('/auth/otp?flow=signup');
    } catch (err: any) {
      const apiError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        t('signupPage.createAccountError', 'Unable to start verification at this time.');
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

  const subtitle = t(wizard.activeStep.subtitleKey, wizard.activeStep.subtitleDefault);

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
                ownSignupEmail: null,
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
                >
                  <StepHost step={wizard.activeStep} />
                </WizardChrome>
              </FormProvider>
            </SignupWizardUiProvider>

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

