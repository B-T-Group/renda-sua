import CloseRounded from '@mui/icons-material/CloseRounded';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import {
  getBrowserDefaultCountryCode,
  getDefaultLoginMethod,
  LoginIdentifierMode,
} from '../../utils/authDefaults';
import Logo from '../common/Logo';

export interface LoginMethodDialogProps {
  open: boolean;
  onClose: () => void;
  /** Post-login redirect; defaults to current path or `/app`. */
  returnTo?: string;
}

function resolveReturnTo(returnTo?: string): string {
  if (returnTo) return returnTo;
  if (typeof window === 'undefined') return '/app';
  const path = `${window.location.pathname}${window.location.search}`;
  return path || '/app';
}

const LoginMethodDialog: React.FC<LoginMethodDialogProps> = ({
  open,
  onClose,
  returnTo,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const resolvedReturnTo = resolveReturnTo(returnTo);

  const browserCountry = getBrowserDefaultCountryCode();
  const [identifierMode, setIdentifierMode] = useState<LoginIdentifierMode>(() =>
    getDefaultLoginMethod(browserCountry)
  );
  const [emailValue, setEmailValue] = useState('');
  const [phoneValue, setPhoneValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLogin = useCallback(
    async (contactInfo: { email?: string; phone_number?: string }) => {
      setSubmitting(true);
      setError(null);
      try {
        await apiClient.post('/auth/login/start-otp', contactInfo, {
          headers: { 'X-Client-Platform': 'web' },
        });

        const destination = contactInfo.email || contactInfo.phone_number || '';
        if (contactInfo.email) {
          sessionStorage.setItem('pendingLoginEmail', contactInfo.email);
        }
        if (contactInfo.phone_number) {
          sessionStorage.setItem('pendingLoginPhone', contactInfo.phone_number);
        }
        sessionStorage.setItem(
          'pendingLoginOtpExpiresAtMs',
          String(Date.now() + 15 * 60 * 1000)
        );
        sessionStorage.setItem('pendingLoginDestination', destination);
        sessionStorage.setItem('pendingLoginReturnTo', resolvedReturnTo);

        navigate(`/otp-auth?flow=login`);
        onClose();
      } catch (err: any) {
        setSubmitting(false);
        setError(
          err?.response?.data?.error ||
            err?.message ||
            t('auth.loginError', 'Failed to send login code. Please try again.')
        );
      }
    },
    [apiClient, navigate, onClose, resolvedReturnTo, t]
  );

  const handlePrimaryContinue = useCallback(() => {
    if (identifierMode === 'phone') {
      const trimmed = phoneValue.trim();
      if (!trimmed) {
        setError(t('auth.phoneRequired', 'Please enter your phone number'));
        return;
      }
      void startLogin({ phone_number: trimmed });
    } else {
      const trimmed = emailValue.trim().toLowerCase();
      if (!trimmed) {
        setError(t('auth.emailRequired', 'Please enter your email address'));
        return;
      }
      if (!trimmed.includes('@')) {
        setError(t('auth.emailInvalid', 'Please enter a valid email address'));
        return;
      }
      void startLogin({ email: trimmed });
    }
  }, [identifierMode, phoneValue, emailValue, startLogin, t]);

  const switchToEmail = useCallback(() => {
    setIdentifierMode('email');
    setError(null);
  }, []);

  const switchToPhone = useCallback(() => {
    setIdentifierMode('phone');
    setError(null);
  }, []);

  const handleSignup = useCallback(() => {
    onClose();
    navigate('/signup');
  }, [navigate, onClose]);

  const primaryLabel = useMemo(() => {
    return t('auth.sendCodeButton', 'Send code');
  }, [t]);

  const primaryHint = useMemo(() => {
    if (identifierMode === 'phone') {
      return t(
        'auth.loginMethodHintPhoneShort',
        'We'll text you a 4-digit code to verify your identity.'
      );
    }
    return t(
      'auth.loginMethodHintEmailOtpShort',
      'We'll email you a 4-digit code to verify your identity.'
    );
  }, [identifierMode, t]);

  const PrimaryIcon = identifierMode === 'phone' ? SmsOutlined : EmailOutlined;

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !submitting) {
        handlePrimaryContinue();
      }
    },
    [submitting, handlePrimaryContinue]
  );

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      aria-labelledby="login-method-dialog-title"
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(6px)' } },
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            maxWidth: fullScreen ? '100%' : 400,
            width: '100%',
            overflow: 'hidden',
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: fullScreen ? 4 : 3,
          pb: 1,
          textAlign: 'center',
        }}
      >
        <IconButton
          aria-label={t('common.close', 'Close')}
          onClick={onClose}
          disabled={submitting}
          size="small"
          sx={{
            position: 'absolute',
            top: fullScreen ? 12 : 8,
            right: 8,
            color: 'text.secondary',
          }}
        >
          <CloseRounded />
        </IconButton>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2.5 }}>
          <Logo size="medium" />
        </Box>

        <Typography
          id="login-method-dialog-title"
          variant="h5"
          component="h2"
          sx={{ fontWeight: 800, letterSpacing: -0.3, mb: 0.75 }}
        >
          {t('auth.login', 'Login')}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ lineHeight: 1.5, px: 1 }}
        >
          {t(
            'auth.loginSubtitle',
            'Sign in with a one-time code sent to your email or phone.'
          )}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pb: fullScreen ? 4 : 3, pt: 2 }}>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
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
                  flexShrink: 0,
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                  color: 'primary.main',
                }}
              >
                <PrimaryIcon fontSize="small" />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.25 }}>
                  {identifierMode === 'phone'
                    ? t('auth.phoneLoginTitle', 'Continue with phone')
                    : t('auth.emailOtpLoginTitle', 'Continue with email code')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                  {primaryHint}
                </Typography>
              </Box>
            </Stack>

            {identifierMode === 'phone' ? (
              <TextField
                fullWidth
                placeholder={
                  browserCountry === 'CM' || browserCountry === 'GA'
                    ? '+237 6 XX XX XX XX'
                    : t('auth.phonePlaceholder', 'Phone number')
                }
                value={phoneValue}
                onChange={(e) => setPhoneValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={submitting}
                autoFocus
                inputProps={{
                  inputMode: 'tel',
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            ) : (
              <TextField
                fullWidth
                type="email"
                placeholder={t('auth.emailPlaceholder', 'you@example.com')}
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={submitting}
                autoFocus
                inputProps={{
                  inputMode: 'email',
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
            )}
          </Box>

          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting}
            onClick={handlePrimaryContinue}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              py: 1.4,
              borderRadius: 2,
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
            }}
          >
            {submitting ? t('common.loading', 'Loading…') : primaryLabel}
          </Button>

          <Button
            variant="text"
            color="primary"
            disabled={submitting}
            onClick={identifierMode === 'phone' ? switchToEmail : switchToPhone}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              alignSelf: 'center',
            }}
          >
            {identifierMode === 'phone'
              ? t('auth.useEmailInstead', 'Use email instead')
              : t('auth.usePhoneInstead', 'Use phone instead')}
          </Button>

          <Box
            sx={{
              borderTop: 1,
              borderColor: 'divider',
              pt: 2.5,
              mt: 0.5,
              textAlign: 'center',
            }}
          >
            <Typography variant="body2" color="text.primary" sx={{ mb: 1.25 }}>
              {t('auth.noAccount', 'No account yet?')}
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              disabled={submitting}
              onClick={handleSignup}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                py: 1.1,
                borderRadius: 2,
              }}
            >
              {t('auth.signUp', 'Sign up')}
            </Button>
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};

export default LoginMethodDialog;
