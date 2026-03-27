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

  const handleOtpLogin = useCallback(async () => {
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
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          <Button
            variant="contained"
            onClick={handleEmailPasswordLogin}
            fullWidth
            sx={{ borderRadius: 0 }}
          >
            {t('auth.loginWithEmailPassword', 'Login with email/password')}
          </Button>
          <Button
            variant="outlined"
            onClick={handleOtpLogin}
            fullWidth
            sx={{ borderRadius: 0 }}
          >
            {t('auth.loginWithOtp', 'Login with one-time password')}
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
