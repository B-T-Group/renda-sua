import { PersonAddAlt } from '@mui/icons-material';
import { Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';

interface SignupHeaderButtonProps {
  /** Use light/outlined style for use on a dark header */
  inverted?: boolean;
  /** Narrow layout: smaller control, no icon (e.g. mobile header) */
  compact?: boolean;
}

const SignupHeaderButton: React.FC<SignupHeaderButtonProps> = ({ inverted, compact }) => {
  const { t } = useTranslation();
  const { isAuthenticated } = useSessionAuth();

  if (isAuthenticated) {
    return null;
  }

  return (
    <Button
      component={RouterLink}
      to="/signup"
      variant={inverted ? 'outlined' : 'contained'}
      color="primary"
      size={compact ? 'small' : 'medium'}
      startIcon={compact ? undefined : <PersonAddAlt fontSize="small" />}
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
      {t('auth.signUp', 'Sign up')}
    </Button>
  );
};

export default SignupHeaderButton;
