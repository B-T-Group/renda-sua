import { useAuth0 } from '@auth0/auth0-react';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import SmsOutlined from '@mui/icons-material/SmsOutlined';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import Logo from '../common/Logo';

export interface LoginMethodDialogProps {
  open: boolean;
  onClose: () => void;
  /** Post-login redirect; defaults to current path or `/app`. */
  returnTo?: string;
}

interface LoginOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  emphasized?: boolean;
}

function resolveReturnTo(returnTo?: string): string {
  if (returnTo) return returnTo;
  if (typeof window === 'undefined') return '/app';
  const path = `${window.location.pathname}${window.location.search}`;
  return path || '/app';
}

function LoginOptionIcon({
  icon,
  emphasized,
}: {
  icon: React.ReactNode;
  emphasized?: boolean;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        bgcolor: emphasized
          ? alpha(theme.palette.primary.main, 0.1)
          : 'grey.100',
        color: emphasized ? 'primary.main' : 'text.secondary',
      }}
    >
      {icon}
    </Box>
  );
}

function LoginOptionRow({
  icon,
  title,
  description,
  onClick,
  emphasized,
}: LoginOptionProps) {
  return (
    <Paper
      elevation={0}
      variant="outlined"
      sx={(theme) => ({
        borderRadius: 3,
        overflow: 'hidden',
        borderWidth: emphasized ? 2 : 1,
        borderColor: emphasized ? 'primary.main' : 'divider',
        transition: theme.transitions.create(
          ['border-color', 'box-shadow', 'transform'],
          { duration: theme.transitions.duration.shorter }
        ),
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: theme.shadows[2],
          transform: 'translateY(-1px)',
        },
        '&:active': {
          transform: 'translateY(0)',
        },
      })}
    >
      <ListItemButton
        onClick={onClick}
        sx={{
          py: 2,
          px: 2,
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <LoginOptionIcon icon={icon} emphasized={emphasized} />
        <ListItemText
          primary={title}
          secondary={description}
          primaryTypographyProps={{
            variant: 'subtitle1',
            fontWeight: 600,
            component: 'span',
          }}
          secondaryTypographyProps={{
            variant: 'body2',
            color: 'text.secondary',
            sx: { mt: 0.25, lineHeight: 1.45 },
          }}
        />
        <ChevronRightRounded
          fontSize="small"
          sx={{ color: 'text.disabled', flexShrink: 0 }}
        />
      </ListItemButton>
    </Paper>
  );
}

const LoginMethodDialog: React.FC<LoginMethodDialogProps> = ({
  open,
  onClose,
  returnTo,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { loginWithRedirect } = useAuth0();
  const resolvedReturnTo = resolveReturnTo(returnTo);

  const redirectToAuth = useCallback(
    async (authorizationParams: Record<string, string>) => {
      try {
        await loginWithRedirect({
          authorizationParams,
          appState: { returnTo: resolvedReturnTo },
        });
      } catch (err: unknown) {
        console.error('loginWithRedirect failed:', err);
      }
    },
    [loginWithRedirect, resolvedReturnTo]
  );

  const handleOtpEmailLogin = useCallback(
    () => redirectToAuth({ connection: 'email' }),
    [redirectToAuth]
  );

  const handleOtpPhoneLogin = useCallback(
    () => redirectToAuth({ connection: 'sms' }),
    [redirectToAuth]
  );

  const handleEmailPasswordLogin = useCallback(
    () => redirectToAuth({ screen_hint: 'login' }),
    [redirectToAuth]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby="login-method-dialog-title"
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(6px)' } },
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 4,
            maxWidth: fullScreen ? '100%' : 440,
            width: '100%',
            overflow: 'hidden',
          },
        },
      }}
    >
      {fullScreen ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            pt: 3,
            pb: 1,
          }}
        >
          <Logo size="medium" />
        </Box>
      ) : null}

      <DialogTitle
        id="login-method-dialog-title"
        sx={{
          pr: 1,
          pt: fullScreen ? 1 : 2.5,
          pb: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h6"
            component="span"
            sx={{ fontWeight: 700, display: 'block', letterSpacing: -0.2 }}
          >
            {t('auth.chooseLoginMethod', 'Choose login method')}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, lineHeight: 1.5 }}
          >
            {t(
              'auth.loginMethodSubtitle',
              'Select how you want to sign in. One-time codes are quick and do not require a password.'
            )}
          </Typography>
        </Box>
        <IconButton
          aria-label={t('common.close', 'Close')}
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary', mt: -0.5 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 2.5, pb: 2, pt: 0 }}>
        <Stack spacing={1.5}>
          <LoginOptionRow
            emphasized
            icon={<SmsOutlined fontSize="medium" />}
            title={t(
              'auth.loginWithOtpPhone',
              'Login with one-time password (phone)'
            )}
            description={t(
              'auth.loginMethodHintPhone',
              'We send a short code by SMS—fastest if you use your phone.'
            )}
            onClick={handleOtpPhoneLogin}
          />

          <LoginOptionRow
            icon={<EmailOutlined fontSize="medium" />}
            title={t(
              'auth.loginWithOtpEmail',
              'Login with one-time password (email)'
            )}
            description={t(
              'auth.loginMethodHintEmailOtp',
              'Receive a code in your inbox—no password to remember.'
            )}
            onClick={handleOtpEmailLogin}
          />

          <Divider sx={{ my: 0.5 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ px: 1, fontWeight: 500 }}
            >
              {t('auth.loginMethodDivider', 'Or')}
            </Typography>
          </Divider>

          <LoginOptionRow
            icon={<LockOutlined fontSize="medium" />}
            title={t(
              'auth.loginWithEmailPassword',
              'Login with email/password'
            )}
            description={t(
              'auth.loginMethodHintPassword',
              'Sign in with the email and password for your account.'
            )}
            onClick={handleEmailPasswordLogin}
          />

          <Typography
            variant="caption"
            color="text.secondary"
            textAlign="center"
            sx={{ pt: 1, px: 1, lineHeight: 1.5, display: 'block' }}
          >
            {t(
              'auth.loginMethodFooterNote',
              'You can change your mind anytime—we only use your choice to start the right sign-in flow.'
            )}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: 2.5,
          pb: fullScreen ? 3 : 2.5,
          pt: 0,
          justifyContent: 'center',
        }}
      >
        <Button
          onClick={onClose}
          color="inherit"
          size="large"
          sx={{ textTransform: 'none', fontWeight: 500, minWidth: 120 }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginMethodDialog;
