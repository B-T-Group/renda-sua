import { useAuth0 } from '@auth0/auth0-react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export interface LoginMethodDialogProps {
  open: boolean;
  onClose: () => void;
}

const LoginMethodDialog: React.FC<LoginMethodDialogProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { loginWithRedirect } = useAuth0();

  const handleOtpEmailLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          connection: 'email',
        },
        appState: { returnTo: '/app' },
      });
    } catch (err: any) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  const handleOtpPhoneLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          connection: 'sms',
        },
        appState: { returnTo: '/app' },
      });
    } catch (err: any) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  const handleEmailPasswordLogin = useCallback(async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          screen_hint: 'login',
        },
        appState: { returnTo: '/app' },
      });
    } catch (err: any) {
      console.error('loginWithRedirect failed:', err);
    }
  }, [loginWithRedirect]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: { sx: { borderRadius: 0 } },
      }}
    >
      <DialogTitle>{t('auth.chooseLoginMethod', 'Choose login method')}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5, alignItems: 'center' }}>
          <Button
            variant="contained"
            onClick={handleOtpPhoneLogin}
            fullWidth
            sx={{ borderRadius: 0, maxWidth: 360 }}
          >
            {t('auth.loginWithOtpPhone', 'Login with one-time password (phone)')}
          </Button>

          <Button
            variant="text"
            onClick={handleOtpEmailLogin}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              borderRadius: 0,
              px: 0.25,
            }}
          >
            {t('auth.loginWithOtpEmail', 'Login with one-time password (email)')}
          </Button>

          <Button
            variant="text"
            onClick={handleEmailPasswordLogin}
            sx={{
              alignSelf: 'flex-start',
              textTransform: 'none',
              textDecoration: 'underline',
              textUnderlineOffset: '2px',
              borderRadius: 0,
              px: 0.25,
            }}
          >
            {t('auth.loginWithEmailPassword', 'Login with email/password')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ borderRadius: 0 }}>
          {t('common.cancel', 'Cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LoginMethodDialog;
