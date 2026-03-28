import { Box, Container, Grid, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PERSONA_HEADER_COLORS } from '../../constants/personaTheme';
import {
  useUserProfileContext,
  UserType,
} from '../../contexts/UserProfileContext';
import LoadingPage from '../common/LoadingPage';
import { PersonaSelectCard } from '../onboarding/PersonaSelectCard';

const PERSONA_ORDER: UserType[] = ['client', 'agent', 'business'];

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
  const [picking, setPicking] = useState<UserType | null>(null);

  const orderedPersonas = useMemo(
    () => PERSONA_ORDER.filter((p) => personas.includes(p)),
    [personas]
  );

  const onPick = useCallback(
    async (p: UserType) => {
      setPicking(p);
      try {
        await setActivePersona(p);
        navigate('/dashboard');
      } finally {
        setPicking(null);
      }
    },
    [navigate, setActivePersona]
  );

  const cardLabel = (p: UserType) =>
    p === 'client'
      ? t('persona.selectCard.client.title', 'Client')
      : p === 'agent'
        ? t('persona.selectCard.agent.title', 'Delivery agent')
        : t('persona.selectCard.business.title', 'Business');

  const cardDescription = (p: UserType) =>
    p === 'client'
      ? t(
          'persona.selectCard.client.description',
          'Browse items, place orders, and track deliveries to your door.'
        )
      : p === 'agent'
        ? t(
            'persona.selectCard.agent.description',
            'See available runs, complete pickups, and get paid for each delivery.'
          )
        : t(
            'persona.selectCard.business.description',
            'Manage your catalog, orders, locations, and rentals in one place.'
          );

  if (loading) {
    return (
      <LoadingPage
        message={t('persona.selectLoading', 'Loading your account')}
        subtitle={t('persona.selectLoadingSubtitle', 'Please wait')}
        showProgress
      />
    );
  }

  if (!needsPersonaSelection && userType) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  return (
    <Box
      sx={{
        minHeight: { xs: 'min(100dvh - 72px, auto)', md: '60vh' },
        py: { xs: 2, sm: 4, md: 5 },
        pl: {
          xs: 'calc(16px + env(safe-area-inset-left, 0px))',
          sm: 'calc(16px + env(safe-area-inset-left, 0px))',
        },
        pr: {
          xs: 'calc(16px + env(safe-area-inset-right, 0px))',
          sm: 'calc(16px + env(safe-area-inset-right, 0px))',
        },
        pb: {
          xs: 'calc(24px + env(safe-area-inset-bottom, 0px))',
          sm: 5,
        },
        background: (theme) =>
          `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, transparent 42%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
      }}
    >
      <Container maxWidth="md" disableGutters sx={{ px: { xs: 0, sm: 2 } }}>
        <Stack
          spacing={{ xs: 0.75, sm: 1 }}
          sx={{ mb: { xs: 2, sm: 3 }, textAlign: 'center', px: { xs: 0.5, sm: 0 } }}
        >
          <Typography
            variant="overline"
            sx={{
              width: '100%',
              textAlign: 'center',
              letterSpacing: { xs: '0.14em', sm: '0.22em' },
              fontWeight: 700,
              color: 'text.secondary',
              fontSize: { xs: '0.65rem', sm: '0.75rem' },
            }}
          >
            {t('persona.selectKicker', 'Welcome back')}
          </Typography>
          <Typography
            component="h1"
            variant="h4"
            sx={{
              width: '100%',
              textAlign: 'center',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
              fontSize: { xs: '1.35rem', sm: '1.75rem', md: '2rem' },
              px: { xs: 0.5, sm: 0 },
            }}
          >
            {t('persona.selectTitle', 'How do you want to use Rendasua?')}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              width: '100%',
              maxWidth: 480,
              mx: 'auto',
              textAlign: 'center',
              lineHeight: 1.55,
              fontSize: { xs: '0.8125rem', sm: '0.9375rem' },
              px: { xs: 0.5, sm: 0 },
            }}
          >
            {t(
              'persona.selectSubtitle',
              'Choose what you want to do today. You can switch anytime from your profile or the header.'
            )}
          </Typography>
        </Stack>

        <Grid
          container
          spacing={{ xs: 1.5, sm: 2 }}
          justifyContent="center"
          alignItems="stretch"
        >
          {orderedPersonas.map((p) => {
            const colors = PERSONA_HEADER_COLORS[p];
            const busy = picking !== null;
            return (
              <Grid
                key={p}
                size={{ xs: 12, sm: 6, md: 4 }}
                sx={{ display: 'flex', justifyContent: 'center' }}
              >
                <Box sx={{ width: '100%', maxWidth: { xs: 400, sm: 'none' }, mx: 'auto' }}>
                <PersonaSelectCard
                  persona={p}
                  accent={colors.main}
                  title={cardLabel(p)}
                  description={cardDescription(p)}
                  ctaText={t('persona.selectCard.cta', 'Continue as {{label}}', {
                    label: cardLabel(p),
                  })}
                  busy={busy}
                  isSelecting={picking === p}
                  onSelect={() => void onPick(p)}
                />
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

export default SelectPersonaPage;
