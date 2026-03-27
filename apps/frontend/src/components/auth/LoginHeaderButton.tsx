import { Login } from '@mui/icons-material';
import { Button } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import LoginMethodDialog from './LoginMethodDialog';

interface LoginHeaderButtonProps {
  /** Use light/outlined style on a dark header */
  inverted?: boolean;
}

const LoginHeaderButton: React.FC<LoginHeaderButtonProps> = ({ inverted }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useSessionAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (isAuthenticated) {
    return null;
  }

  return (
    <>
      <Button
        variant={inverted ? 'outlined' : 'contained'}
        color="primary"
        startIcon={<Login />}
        onClick={() => setDialogOpen(true)}
        sx={{
          px: { xs: 2, sm: 3 },
          py: 1,
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
      <LoginMethodDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default LoginHeaderButton;
