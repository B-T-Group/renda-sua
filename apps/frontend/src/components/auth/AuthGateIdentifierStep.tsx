import EmailOutlined from '@mui/icons-material/EmailOutlined';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getBrowserDefaultCountryCode,
  getDefaultLoginMethod,
  type LoginIdentifierMode,
} from '../../utils/authDefaults';
import { nationalDigitsToE164 } from '../../utils/phoneUtils';
import { getAuthOtpCodeLength } from '../../config/authConfig';

export interface AuthGateIdentifierStepProps {
  disabled?: boolean;
  error: string | null;
  showPasswordLink?: boolean;
  onClearError: () => void;
  onValidationError: (message: string) => void;
  onSubmit: (payload: { email?: string; phone_number?: string }) => void;
  onUsePassword?: () => void;
}

const AuthGateIdentifierStep: React.FC<AuthGateIdentifierStepProps> = ({
  disabled,
  error,
  showPasswordLink,
  onClearError,
  onValidationError,
  onSubmit,
  onUsePassword,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const browserCountry = getBrowserDefaultCountryCode();
  const otpLen = getAuthOtpCodeLength();
  const [identifierMode, setIdentifierMode] = useState<LoginIdentifierMode>(() =>
    getDefaultLoginMethod(browserCountry)
  );
  const [emailValue, setEmailValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');

  const submit = useCallback(() => {
    onClearError();
    if (identifierMode === 'phone') {
      const trimmed = phoneValue.trim();
      if (!trimmed) {
        onValidationError(t('auth.phoneRequired', 'Please enter your phone number'));
        return;
      }
      try {
        onSubmit({ phone_number: nationalDigitsToE164(trimmed, browserCountry) });
      } catch (err: any) {
        onValidationError(
          err?.message || t('auth.phoneInvalid', 'Invalid phone number')
        );
      }
      return;
    }
    const trimmed = emailValue.trim().toLowerCase();
    if (!trimmed) {
      onValidationError(t('auth.emailRequired', 'Please enter your email address'));
      return;
    }
    if (!trimmed.includes('@')) {
      onValidationError(t('auth.emailInvalid', 'Please enter a valid email address'));
      return;
    }
    onSubmit({ email: trimmed });
  }, [
    browserCountry,
    emailValue,
    identifierMode,
    onClearError,
    onSubmit,
    onValidationError,
    phoneValue,
    t,
  ]);

  const PrimaryIcon = identifierMode === 'phone' ? SmsOutlined : EmailOutlined;

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={onClearError}>
          {error}
        </Alert>
      )}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 2.5,
          p: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.03),
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              color: 'primary.main',
            }}
          >
            <PrimaryIcon fontSize="small" />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {identifierMode === 'phone'
                ? t('auth.phoneLoginTitle', 'Continue with phone')
                : t('auth.emailOtpLoginTitle', 'Continue with email code')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {identifierMode === 'phone'
                ? t(
                    'auth.gate.hintPhone',
                    'We’ll text you a {{count}}-digit code.',
                    { count: otpLen }
                  )
                : t(
                    'auth.gate.hintEmail',
                    'We’ll email you a {{count}}-digit code.',
                    { count: otpLen }
                  )}
            </Typography>
          </Box>
        </Stack>
        {identifierMode === 'phone' ? (
          <TextField
            fullWidth
            placeholder={t('auth.phonePlaceholder', 'Phone number')}
            value={phoneValue}
            onChange={(e) => setPhoneValue(e.target.value)}
            disabled={disabled}
            autoFocus
            inputProps={{ inputMode: 'tel' }}
          />
        ) : (
          <TextField
            fullWidth
            type="email"
            placeholder={t('auth.emailPlaceholder', 'you@example.com')}
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            disabled={disabled}
            autoFocus
            inputProps={{ inputMode: 'email' }}
          />
        )}
      </Box>
      <Button variant="contained" size="large" disabled={disabled} onClick={submit}>
        {t('auth.sendCodeButton', 'Send code')}
      </Button>
      <Button
        variant="text"
        disabled={disabled}
        onClick={() => {
          onClearError();
          setIdentifierMode((m) => (m === 'phone' ? 'email' : 'phone'));
        }}
      >
        {identifierMode === 'phone'
          ? t('auth.useEmailInstead', 'Use email instead')
          : t('auth.usePhoneInstead', 'Use phone instead')}
      </Button>
      {showPasswordLink && identifierMode === 'email' && onUsePassword ? (
        <Button variant="text" disabled={disabled} onClick={onUsePassword}>
          {t('auth.gate.usePasswordInstead', 'Use password instead')}
        </Button>
      ) : null}
    </Stack>
  );
};

export default AuthGateIdentifierStep;
