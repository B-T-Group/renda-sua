import { Login } from '@mui/icons-material';
import { Button } from '@mui/material';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSessionAuth } from '../../contexts/SessionAuthContext';
import LoginMethodDialog from './LoginMethodDialog';

interface LoginHeaderButtonProps {
  /** Use light/outlined style on a dark header */
  inverted?: boolean;
  /** Narrow layout: smaller control, no icon (e.g. mobile header) */
  compact?: boolean;
}

const LoginHeaderButton: React.FC<LoginHeaderButtonProps> = ({ inverted, compact }) => {
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
        size={compact ? 'small' : 'medium'}
        startIcon={compact ? undefined : <Login fontSize="small" />}
        onClick={() => setDialogOpen(true)}
        sx={{
          borderRadius: 0,
          px: compact ? { xs: 0.75, sm: 1 } : { xs: 2, sm: 3 },
          py: compact ? 0.5 : 1,
          my: compact ? 0 : { xs: 0.5, sm: 0 },
          minWidth: compact ? 0 : undefined,
          fontSize: compact ? '0.75rem' : '1rem',
          fontWeight: 600,
          lineHeight: compact ? 1.2 : undefined,
          whiteSpace: 'nowrap',
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
