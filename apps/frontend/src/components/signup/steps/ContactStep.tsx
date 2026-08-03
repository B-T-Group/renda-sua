import {
  EmailOutlined as EmailOutlinedIcon,
  Person as PersonIcon,
  PersonOutline as PersonOutlineIcon,
  PhoneOutlined as PhoneOutlinedIcon,
} from '@mui/icons-material';
import { InputAdornment, Stack, TextField, Typography } from '@mui/material';
import React, { useEffect } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useApiClient } from '../../../hooks/useApiClient';
import PhoneInput from '../../common/PhoneInput';
import type { SignupFormValues } from '../wizard/types';

function isValidEmailFormat(email: string): boolean {
  const s = email.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
}

export const ContactStep: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const {
    control,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext<SignupFormValues>();

  const email = watch('contact.email');

  useEffect(() => {
    if (!isValidEmailFormat(email || '')) {
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
        if (data?.taken) {
          setError('contact.email', {
            type: 'validate',
            message: t('signupPage.emailTaken', 'This email is already taken.'),
          });
        } else {
          clearErrors('contact.email');
        }
      } catch {
        if (!controller.signal.aborted) clearErrors('contact.email');
      }
    }, 500);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [apiClient, clearErrors, email, setError, t]);

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
            error={Boolean(errors.contact?.email)}
            helperText={
              errors.contact?.email?.message ||
              t('signupPage.checkingEmailHint', ' ')
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
