import { useAuth0 } from '@auth0/auth0-react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  EmailSignInMode,
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

function MethodChip({
  selected,
  label,
  onClick,
  disabled,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      sx={{
        flex: 1,
        border: 0,
        cursor: disabled ? 'default' : 'pointer',
        py: 1.1,
        px: 1.5,
        borderRadius: 1.5,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
        color: selected ? 'primary.main' : 'text.secondary',
        fontWeight: selected ? 700 : 500,
        fontSize: '0.875rem',
        fontFamily: 'inherit',
        transition: theme.transitions.create(['background-color', 'color'], {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover': disabled
          ? undefined
          : {
              bgcolor: selected
                ? alpha(theme.palette.primary.main, 0.16)
                : alpha(theme.palette.action.hover, 0.04),
            },
      }}
    >
      {label}
    </Box>
  );
}

const LoginMethodDialog: React.FC<LoginMethodDialogProps> = ({
  open,
  onClose,
  returnTo,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { loginWithRedirect } = useAuth0();
  const resolvedReturnTo = resolveReturnTo(returnTo);

  const [identifierMode, setIdentifierMode] = useState<LoginIdentifierMode>(() =>
    getDefaultLoginMethod(getBrowserDefaultCountryCode())
  );
  const [emailSignInMode, setEmailSignInMode] = useState<EmailSignInMode>('otp');
  const [submitting, setSubmitting] = useState(false);

  const redirectToAuth = useCallback(
    async (authorizationParams: Record<string, string>) => {
      setSubmitting(true);
      try {
        await loginWithRedirect({
          authorizationParams,
          appState: { returnTo: resolvedReturnTo },
        });
      } catch (err: unknown) {
        console.error('loginWithRedirect failed:', err);
        setSubmitting(false);
      }
    },
    [loginWithRedirect, resolvedReturnTo]
  );

  const handlePrimaryContinue = useCallback(() => {
    if (identifierMode === 'phone') {
      void redirectToAuth({ connection: 'sms' });
      return;
    }
    if (emailSignInMode === 'otp') {
      void redirectToAuth({ connection: 'email' });
      return;
    }
    void redirectToAuth({ screen_hint: 'login' });
  }, [identifierMode, emailSignInMode, redirectToAuth]);

  const switchToEmail = useCallback(() => {
    setIdentifierMode('email');
    setEmailSignInMode('otp');
  }, []);

  const switchToPhone = useCallback(() => {
    setIdentifierMode('phone');
  }, []);

  const handleSignup = useCallback(() => {
    onClose();
    navigate('/signup');
  }, [navigate, onClose]);

  const primaryLabel = useMemo(() => {
    if (identifierMode === 'phone' || emailSignInMode === 'otp') {
      return t('auth.sendCodeButton', 'Send code');
    }
    return t('auth.signIn', 'Sign In');
  }, [identifierMode, emailSignInMode, t]);

  const primaryHint = useMemo(() => {
    if (identifierMode === 'phone') {
      return t(
        'auth.loginMethodHintPhoneShort',
        'We’ll open a secure page to text you a short code.'
      );
    }
    if (emailSignInMode === 'otp') {
      return t(
        'auth.loginMethodHintEmailOtpShort',
        'We’ll open a secure page to email you a one-time code.'
      );
    }
    return t(
      'auth.loginMethodHintPasswordShort',
      'We’ll open a secure page to sign in with your email and password.'
    );
  }, [identifierMode, emailSignInMode, t]);

  const PrimaryIcon =
    identifierMode === 'phone'
      ? SmsOutlined
      : emailSignInMode === 'otp'
        ? EmailOutlined
        : LockOutlined;

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
            'Sign in with a one-time code — or use your password if you prefer.'
          )}
        </Typography>
      </Box>

      <DialogContent sx={{ px: 3, pb: fullScreen ? 4 : 3, pt: 2 }}>
        <Stack spacing={2}>
          {/* Primary path card */}
          <Box
            sx={{
              border: 1,
              borderColor: 'divider',
              borderRadius: 2.5,
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.03),
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
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
                    : emailSignInMode === 'otp'
                      ? t('auth.emailOtpLoginTitle', 'Continue with email code')
                      : t('auth.passwordLoginTitle', 'Continue with password')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                  {primaryHint}
                </Typography>
              </Box>
            </Stack>

            {identifierMode === 'email' ? (
              <Box
                sx={{
                  mt: 2,
                  display: 'flex',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 0.5,
                  bgcolor: 'background.paper',
                }}
              >
                <MethodChip
                  selected={emailSignInMode === 'otp'}
                  label={t('auth.signInWithOtp', 'Send code')}
                  onClick={() => setEmailSignInMode('otp')}
                  disabled={submitting}
                />
                <MethodChip
                  selected={emailSignInMode === 'password'}
                  label={t('auth.signInWithPassword', 'Password')}
                  onClick={() => setEmailSignInMode('password')}
                  disabled={submitting}
                />
              </Box>
            ) : null}
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
