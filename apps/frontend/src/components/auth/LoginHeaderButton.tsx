import { Login } from '@mui/icons-material';
import { Button, IconButton } from '@mui/material';
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
      {compact ? (
        <IconButton
          aria-label={t('auth.signIn', 'Sign In')}
          onClick={() => setDialogOpen(true)}
          size="small"
          sx={{
            color: inverted ? 'rgba(255,255,255,0.92)' : 'primary.main',
            '&:hover': {
              backgroundColor: inverted
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(25, 118, 210, 0.08)',
            },
          }}
        >
          <Login fontSize="small" />
        </IconButton>
      ) : (
        <Button
          variant={inverted ? 'text' : 'contained'}
          color="primary"
          size="medium"
          startIcon={<Login fontSize="small" />}
          onClick={() => setDialogOpen(true)}
          sx={{
            borderRadius: 0,
            px: { xs: 1.25, sm: 1.5 },
            py: 0.75,
            my: { xs: 0.5, sm: 0 },
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'none',
            whiteSpace: 'nowrap',
            ...(inverted && {
              color: 'rgba(255,255,255,0.92)',
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.08)',
                textDecoration: 'underline',
                textUnderlineOffset: '3px',
              },
            }),
          }}
        >
          {t('auth.signIn', 'Sign In')}
        </Button>
      )}
      <LoginMethodDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default LoginHeaderButton;
