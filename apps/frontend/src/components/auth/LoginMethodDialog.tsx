import { useAuth0 } from '@auth0/auth0-react';
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
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface LoginMethodDialogProps {
  open: boolean;
  onClose: () => void;
}

interface LoginOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  emphasized?: boolean;
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
        borderRadius: 2,
        overflow: 'hidden',
        borderWidth: emphasized ? 2 : 1,
        borderColor: emphasized ? 'primary.main' : 'divider',
        transition: theme.transitions.create(['border-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter,
        }),
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: theme.shadows[2],
        },
      })}
    >
      <ListItemButton
        onClick={onClick}
        sx={{
          py: 2,
          px: 2,
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 48,
            mt: 0.25,
            color: emphasized ? 'primary.main' : 'text.secondary',
          }}
        >
          {icon}
        </ListItemIcon>
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
            sx: { mt: 0.25 },
          }}
        />
      </ListItemButton>
    </Paper>
  );
}

const LoginMethodDialog: React.FC<LoginMethodDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const { loginWithRedirect } = useAuth0();

  const handleOtpEmailLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: { connection: 'email' },
        appState: { returnTo: '/app' },
      });
    } catch (err: unknown) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  const handleOtpPhoneLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: { connection: 'sms' },
        appState: { returnTo: '/app' },
      });
    } catch (err: unknown) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  const handleEmailPasswordLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: { screen_hint: 'login' },
        appState: { returnTo: '/app' },
      });
    } catch (err: unknown) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      aria-labelledby="login-method-dialog-title"
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(4px)' } },
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            maxWidth: fullScreen ? '100%' : 440,
            width: '100%',
          },
        },
      }}
    >
      <DialogTitle
        id="login-method-dialog-title"
        sx={{
          pr: 1,
          pt: 2.5,
          pb: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" component="span" sx={{ fontWeight: 700, display: 'block' }}>
            {t('auth.chooseLoginMethod', 'Choose login method')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.5 }}>
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

      <DialogContent sx={{ px: 2.5, pb: 3, pt: 0 }}>
        <Stack spacing={2}>
          <LoginOptionRow
            emphasized
            icon={<SmsOutlined fontSize="medium" />}
            title={t('auth.loginWithOtpPhone', 'Login with one-time password (phone)')}
            description={t(
              'auth.loginMethodHintPhone',
              'We send a short code by SMS—fastest if you use your phone.'
            )}
            onClick={handleOtpPhoneLogin}
          />

          <LoginOptionRow
            icon={<EmailOutlined fontSize="medium" />}
            title={t('auth.loginWithOtpEmail', 'Login with one-time password (email)')}
            description={t(
              'auth.loginMethodHintEmailOtp',
              'Receive a code in your inbox—no password to remember.'
            )}
            onClick={handleOtpEmailLogin}
          />

          <Divider sx={{ my: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>
              {t('auth.loginMethodDivider', 'Or')}
            </Typography>
          </Divider>

          <LoginOptionRow
            icon={<LockOutlined fontSize="medium" />}
            title={t('auth.loginWithEmailPassword', 'Login with email/password')}
            description={t(
              'auth.loginMethodHintPassword',
              'Use your email address and account password with Auth0.'
            )}
            onClick={handleEmailPasswordLogin}
          />

          <Typography variant="caption" color="text.secondary" textAlign="center" sx={{ pt: 0.5 }}>
            {t(
              'auth.loginMethodFooterNote',
              'You can change your mind anytime—we only use your choice to start the right sign-in flow.'
            )}
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, justifyContent: 'center' }}>
        <Button
          onClick={onClose}
          color="inherit"
          sx={{ textTransform: 'none', fontWeight: 500 }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginMethodDialog;
