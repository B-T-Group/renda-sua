import { useAuth0 } from '@auth0/auth0-react';
import { Login } from '@mui/icons-material';
import { Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface LoginButtonProps {
  /** Use light/outlined style for use on a dark header */
  inverted?: boolean;
}

const LoginButton: React.FC<LoginButtonProps> = ({ inverted }) => {
  const { t } = useTranslation();
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: '/app' }, // Redirect to /app after login for profile checking
    });
  };

  if (isAuthenticated) {
    return null;
  }

  return (
    <Button
      variant={inverted ? 'outlined' : 'contained'}
      color="primary"
      startIcon={<Login />}
      onClick={handleLogin}
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
  );
};

export default LoginButton;
