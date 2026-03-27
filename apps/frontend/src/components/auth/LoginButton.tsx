import { useAuth0 } from '@auth0/auth0-react';
import { Login } from '@mui/icons-material';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';

interface LoginButtonProps {
  /** Use light/outlined style for use on a dark header */
  inverted?: boolean;
}

const LoginButton: React.FC<LoginButtonProps> = ({ inverted }) => {
  const { t } = useTranslation();
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated } = useSessionAuth();
  const [modalOpen, setModalOpen] = useState(false);

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

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <Button
        variant={inverted ? 'outlined' : 'contained'}
        color="primary"
        startIcon={<Login />}
        onClick={() => setModalOpen(true)}
        sx={{
          px: 3,
          py: 1,
          mx: { xs: 0.75, sm: 1.25 },
          my: { xs: 0.5, sm: 0 },
          fontSize: '1rem',
          fontWeight: 600,
          ...(inverted && {
            color: '#ffffff',
            borderColor: 'rgba(255,255,255,0.8)',
            '&:hover': {
              borderColor: '#ffffff',
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
          }),
        }}
      >
        {t('auth.signIn', 'Sign In')}
      </Button>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{t('auth.chooseLoginMethod', 'Choose login method')}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Button
              variant="contained"
              onClick={handleEmailPasswordLogin}
              fullWidth
            >
              {t('auth.loginWithEmailPassword', 'Login with email/password')}
            </Button>
            <Button
              variant="outlined"
              onClick={handleOtpLogin}
              fullWidth
            >
              {t('auth.loginWithOtp', 'Login with one-time password')}
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default LoginButton;
