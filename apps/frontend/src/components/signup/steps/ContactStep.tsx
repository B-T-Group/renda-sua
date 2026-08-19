import {
  EmailOutlined as EmailOutlinedIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  PhoneOutlined as PhoneOutlinedIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import PhoneInput from '../../common/PhoneInput';
import { useSignupWizardUi } from '../wizard/SignupWizardUiContext';
import type { SignupFormValues } from '../wizard/types';

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

function isOwnSignupEmail(email: string, ownSignupEmail: string | null): boolean {
  if (!ownSignupEmail) return false;
  return email.trim().toLowerCase() === ownSignupEmail.trim().toLowerCase();
}

function EmailTakenHelper({ onLoginInstead }: { onLoginInstead: () => void }) {
  const { t } = useTranslation();
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        mt: 0.25,
      }}
    >
      <Box component="span">
        {t('signupPage.emailTaken', 'This email is already in use.')}
      </Box>
      <Button
        type="button"
        size="small"
        onClick={onLoginInstead}
        sx={{ minHeight: 32, py: 0, px: 0.5, textTransform: 'none', fontWeight: 700 }}
      >
        {t('signupPage.logInInstead', 'Log in instead')}
      </Button>
    </Box>
  );
}

export const ContactStep: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { onLoginInstead, emailTaken, setEmailTaken, ownSignupEmail } =
    useSignupWizardUi();
  const {
    control,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<SignupFormValues>();

  const email = watch('contact.email');
  const selectedCountry = (watch('country') || 'US').toUpperCase();

  useEffect(() => {
    if (!isValidEmailFormat(email || '')) {
      setEmailTaken(false);
      clearErrors('contact.email');
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get<{ taken: boolean }>(
          '/auth/email-availability',
          { params: { email: email.trim() }, signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (data?.taken && !isOwnSignupEmail(email, ownSignupEmail)) {
          setEmailTaken(true);
          setError('contact.email', {
            type: 'emailTaken',
            message: t('signupPage.emailTaken', 'This email is already in use.'),
          });
        } else {
          setEmailTaken(false);
          clearErrors('contact.email');
        }
      } catch {
        if (!controller.signal.aborted) {
          setEmailTaken(false);
          clearErrors('contact.email');
        }
      }
    }, 500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [apiClient, clearErrors, email, ownSignupEmail, setEmailTaken, setError, t]);

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <Controller
        name="contact.firstName"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={t('signupPage.firstName', 'First name')}
            required
            autoComplete="given-name"
            error={Boolean(errors.contact?.firstName)}
            helperText={errors.contact?.firstName?.message || ' '}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Controller
        name="contact.lastName"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={t('signupPage.lastName', 'Last name')}
            required
            autoComplete="family-name"
            error={Boolean(errors.contact?.lastName)}
            helperText={errors.contact?.lastName?.message || ' '}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Controller
        name="contact.email"
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            fullWidth
            label={t('signupPage.email', 'Email')}
            type="email"
            required
            autoComplete="email"
            error={emailTaken || Boolean(errors.contact?.email)}
            helperText={
              emailTaken ? (
                <EmailTakenHelper onLoginInstead={onLoginInstead} />
              ) : (
                errors.contact?.email?.message ||
                t('signupPage.checkingEmailHint', ' ')
              )
            }
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <EmailOutlinedIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />
        )}
      />
      <Controller
        name="contact.phone"
        control={control}
        render={({ field }) => (
          <PhoneInput
            value={field.value}
            onChange={(value) => field.onChange(value || '')}
            squareEdges
            label={t('signupPage.phoneNumber', 'Phone number')}
            helperText={
              errors.contact?.phone?.message ||
              t(
                'signupPage.phoneHelper',
                'Use the mobile number linked to your payment account.'
              )
            }
            error={Boolean(errors.contact?.phone)}
            required
            useDevPhoneDropdown
            defaultCountry={selectedCountry}
            country={selectedCountry}
            disableCountrySelect
            startAdornment={
              <InputAdornment position="start">
                <PhoneOutlinedIcon fontSize="small" color="action" />
              </InputAdornment>
            }
          />
        )}
      />
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.45 }}>
        {t(
          'signupPage.trustContact',
          "We'll only use this to verify your account and send order updates."
        )}
      </Typography>
    </Stack>
  );
};
