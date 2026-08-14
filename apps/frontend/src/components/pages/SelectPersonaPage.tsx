import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { StorefrontOutlined } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PERSONA_HEADER_COLORS } from '../../constants/personaTheme';
import {
  useUserProfileContext,
  UserType,
} from '../../contexts/UserProfileContext';
import type { DelegationGrant } from '../../types/delegation';
import LoadingPage from '../common/LoadingPage';
import { PersonaSelectCard } from '../onboarding/PersonaSelectCard';

const PERSONA_ORDER: UserType[] = ['client', 'agent', 'business'];

type Picking =
  | { kind: 'persona'; persona: UserType }
  | { kind: 'delegation'; id: string }
  | null;

const SelectPersonaPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    personas,
    delegations,
    setActiveContext,
    loading,
    needsContextSelection,
    userType,
    activeContext,
  } = useUserProfileContext();
  const [picking, setPicking] = useState<Picking>(null);

  const orderedPersonas = useMemo(
    () => PERSONA_ORDER.filter((p) => personas.includes(p)),
    [personas]
  );

  const goAfterPick = useCallback(
    (ctx: { kind: 'persona'; persona: UserType } | { kind: 'delegation' }) => {
      if (ctx.kind === 'delegation') {
        navigate('/delegate/orders');
        return;
      }
      navigate('/dashboard');
    },
    [navigate]
  );

  const onPickPersona = useCallback(
    async (p: UserType) => {
      setPicking({ kind: 'persona', persona: p });
      try {
        await setActiveContext({ kind: 'persona', persona: p });
        goAfterPick({ kind: 'persona', persona: p });
      } finally {
        setPicking(null);
      }
    },
    [goAfterPick, setActiveContext]
  );

  const onPickDelegation = useCallback(
    async (grant: DelegationGrant) => {
      setPicking({ kind: 'delegation', id: grant.id });
      try {
        await setActiveContext({
          kind: 'delegation',
          delegationId: grant.id,
        });
        goAfterPick({ kind: 'delegation' });
      } finally {
        setPicking(null);
      }
    },
    [goAfterPick, setActiveContext]
  );

  const cardLabel = (p: UserType) =>
    p === 'client'
      ? t('persona.selectCard.client.title', 'Client')
      : p === 'agent'
        ? t('persona.selectCard.agent.title', 'Agent')
        : t('persona.selectCard.business.title', 'Business');

  if (loading) {
    return (
      <LoadingPage
        message={t('persona.selectLoading', 'Loading your account')}
        subtitle={t('persona.selectLoadingSubtitle', 'Please wait')}
        showProgress
      />
    );
  }

  const hasAnyContext = orderedPersonas.length > 0 || delegations.length > 0;
  if (!needsContextSelection && hasAnyContext) {
    if (activeContext?.kind === 'delegation') {
      navigate('/delegate/orders', { replace: true });
      return null;
    }
    if (userType) {
      navigate('/dashboard', { replace: true });
      return null;
    }
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
          alignItems="center"
          sx={{
            mb: { xs: 2, sm: 3 },
            textAlign: 'center',
            px: { xs: 0.5, sm: 0 },
            width: '100%',
          }}
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
            {delegations.length > 0
              ? t(
                  'delegation.context.selectTitle',
                  'Where do you want to work today?'
                )
              : t('persona.selectTitle', 'How do you want to use Rendasua?')}
          </Typography>
          <Typography
            color="text.secondary"
            component="p"
            sx={{
              alignSelf: 'center',
              width: '100%',
              maxWidth: 480,
              mx: 'auto',
              textAlign: 'center',
              lineHeight: 1.55,
              fontSize: { xs: '0.8125rem', sm: '0.9375rem' },
              px: { xs: 0.5, sm: 0 },
              boxSizing: 'border-box',
            }}
          >
            {delegations.length > 0
              ? t(
                  'delegation.context.selectSubtitle',
                  'Choose a persona or a location you were invited to manage.'
                )
              : t(
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
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: { xs: 400, sm: 'none' },
                    mx: 'auto',
                  }}
                >
                  <PersonaSelectCard
                    persona={p}
                    accent={colors.main}
                    title={cardLabel(p)}
                    ctaText={t('persona.selectCard.cta', 'Continue as {{label}}', {
                      label: cardLabel(p),
                    })}
                    busy={busy}
                    isSelecting={
                      picking?.kind === 'persona' && picking.persona === p
                    }
                    onSelect={() => void onPickPersona(p)}
                  />
                </Box>
              </Grid>
            );
          })}

          {delegations.map((grant) => {
            const busy = picking !== null;
            const selecting =
              picking?.kind === 'delegation' && picking.id === grant.id;
            return (
              <Grid
                key={grant.id}
                size={{ xs: 12, sm: 6, md: 4 }}
                sx={{ display: 'flex', justifyContent: 'center' }}
              >
                <Card
                  elevation={0}
                  sx={{
                    width: '100%',
                    maxWidth: { xs: 400, sm: 'none' },
                    mx: 'auto',
                    border: '1.5px solid',
                    borderColor: alpha('#0d9488', 0.35),
                    bgcolor: alpha('#0d9488', 0.06),
                    borderRadius: 2,
                    opacity: busy && !selecting ? 0.55 : 1,
                  }}
                >
                  <CardActionArea
                    disabled={busy}
                    onClick={() => void onPickDelegation(grant)}
                    sx={{ height: '100%', minHeight: 180 }}
                  >
                    <CardContent>
                      <Stack spacing={1.25} alignItems="flex-start">
                        <StorefrontOutlined sx={{ color: '#0d9488' }} />
                        <Typography variant="h6" fontWeight={800}>
                          {grant.locationName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {grant.businessName}
                        </Typography>
                        <Typography variant="caption" fontWeight={700}>
                          {grant.role.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {selecting ? (
                            <CircularProgress size={16} />
                          ) : null}
                          <Typography variant="body2" fontWeight={700}>
                            {t(
                              'delegation.context.continue',
                              'Continue at this location'
                            )}
                          </Typography>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
};

export default SelectPersonaPage;
