import {
  Box,
  Button,
  Container,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useUserProfileContext,
  UserType,
} from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';

const labels: Record<UserType, string> = {
  client: 'Client',
  agent: 'Delivery agent',
  business: 'Business',
};

const SelectPersonaPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    personas,
    setActivePersona,
    loading,
    needsPersonaSelection,
    userType,
  } = useUserProfileContext();

  const onPick = useCallback(
    async (p: UserType) => {
      await setActivePersona(p);
      navigate('/app');
    },
    [navigate, setActivePersona]
  );

  if (loading) {
    return (
      <LoadingPage
        message={t('persona.selectLoading', 'Loading your account')}
        subtitle={t(
          'persona.selectLoadingSubtitle',
          'Please wait'
        )}
        showProgress
      />
    );
  }

  if (!needsPersonaSelection && userType) {
    navigate('/app', { replace: true });
    return null;
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Typography variant="h5" gutterBottom fontWeight={600}>
        {t('persona.selectTitle', 'How do you want to use Rendasua?')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t(
          'persona.selectSubtitle',
          'Choose a mode. You can switch later from your profile.'
        )}
      </Typography>
      <Stack spacing={2}>
        {personas.map((p) => (
          <Button
            key={p}
            variant="contained"
            size="large"
            onClick={() => onPick(p)}
            sx={{ py: 2, justifyContent: 'flex-start' }}
          >
            <Box textAlign="left">
              <Typography fontWeight={600}>{labels[p]}</Typography>
            </Box>
          </Button>
        ))}
      </Stack>
    </Container>
  );
};

export default SelectPersonaPage;
