import { PersonAddAlt } from '@mui/icons-material';
import { Button } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useSessionAuth } from '../../contexts/SessionAuthContext';

interface SignupHeaderButtonProps {
  /** Use light/outlined style for use on a dark header */
  inverted?: boolean;
}

const SignupHeaderButton: React.FC<SignupHeaderButtonProps> = ({ inverted }) => {
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
      startIcon={<PersonAddAlt />}
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
      {t('auth.signUp', 'Sign up')}
    </Button>
  );
};

export default SignupHeaderButton;
