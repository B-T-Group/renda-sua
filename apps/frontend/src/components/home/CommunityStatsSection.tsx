import { Box, Container, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketplacePublicStats } from '../../hooks/useMarketplacePublicStats';
import CommunityStatsIllustration from './CommunityStatsIllustration';
import { HOME_ACCENTS } from './homeTheme';

const POLL_MS = 5 * 60 * 1000;

const CommunityStatsSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();
  const { stats, loading, error } = useMarketplacePublicStats({
    refetchIntervalMs: POLL_MS,
  });

  if (error && !stats) return null;

  return (
    <Box
      component="section"
      sx={{
        py: { xs: 6, md: 8 },
        bgcolor: alpha(HOME_ACCENTS.primary, 0.04),
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Container maxWidth="lg">
        <StatsHeader reduceMotion={Boolean(shouldReduce)} />
        <CommunityStatsIllustration
          loading={loading && !stats}
          counts={{
            clients: stats?.clients ?? 0,
            agents: stats?.agents ?? 0,
            businesses: stats?.merchants ?? 0,
            products: stats?.products ?? 0,
          }}
        />
        <Typography
          variant="body2"
          sx={{
            mt: 1,
            textAlign: 'center',
            color: 'text.secondary',
            maxWidth: 420,
            mx: 'auto',
          }}
        >
          {t(
            'home.stats.networkCaption',
            'Four sides of the same marketplace — growing together in your city.'
          )}
        </Typography>
      </Container>
    </Box>
  );
};

const StatsHeader: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ textAlign: 'center', mb: 3 }}>
      <LiveBadge reduceMotion={reduceMotion} />
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <Typography
          variant="overline"
          sx={{
            color: 'primary.main',
            fontWeight: 700,
            letterSpacing: '0.12em',
            display: 'block',
            mb: 1,
          }}
        >
          {t('home.stats.eyebrow', 'A growing local marketplace')}
        </Typography>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: '1.75rem', md: '2.4rem' },
            fontWeight: 800,
            letterSpacing: '-0.025em',
            lineHeight: 1.15,
            mb: 1.5,
          }}
        >
          {t('home.stats.title', 'Join thousands already on Rendasua')}
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto' }}
        >
          {t(
            'home.stats.subtitle',
            'Real people, real shops, and real products in your city — updated live.'
          )}
        </Typography>
      </motion.div>
    </Box>
  );
};

const LiveBadge: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const { t } = useTranslation();
  return (
    <Stack
      direction="row"
      spacing={1}
      justifyContent="center"
      alignItems="center"
      sx={{ mb: 2 }}
    >
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'success.main',
          animation: reduceMotion
            ? 'none'
            : 'communityLivePulse 1.8s ease-in-out infinite',
          '@keyframes communityLivePulse': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.4, transform: 'scale(1.45)' },
          },
        }}
      />
      <Typography
        variant="caption"
        sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em' }}
      >
        {t('home.stats.liveLabel', 'Updates every few minutes')}
      </Typography>
    </Stack>
  );
};

export default CommunityStatsSection;
