import {
  DirectionsBike,
  Inventory2,
  People,
  Storefront,
} from '@mui/icons-material';
import {
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from 'framer-motion';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketplacePublicStats } from '../../hooks/useMarketplacePublicStats';
import CommunityStatsIllustration from './CommunityStatsIllustration';
import { HOME_ACCENTS } from './homeTheme';

const POLL_MS = 5 * 60 * 1000;

type StatDef = {
  key: string;
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
};

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
        <CommunityStatsIllustration />
        {loading && !stats ? (
          <StatsSkeleton />
        ) : (
          <StatsGrid stats={buildStatDefs(stats, t)} reduceMotion={Boolean(shouldReduce)} />
        )}
      </Container>
    </Box>
  );
};

function buildStatDefs(
  stats: {
    clients?: number;
    agents?: number;
    merchants?: number;
    products?: number;
  } | null,
  t: (key: string, fallback: string) => string
): StatDef[] {
  return [
    {
      key: 'clients',
      value: stats?.clients ?? 0,
      label: t('home.stats.clients', 'Clients'),
      color: HOME_ACCENTS.primary,
      icon: <People sx={{ fontSize: 28, color: HOME_ACCENTS.primary }} />,
    },
    {
      key: 'agents',
      value: stats?.agents ?? 0,
      label: t('home.stats.agents', 'Agents'),
      color: HOME_ACCENTS.delivery,
      icon: <DirectionsBike sx={{ fontSize: 28, color: HOME_ACCENTS.delivery }} />,
    },
    {
      key: 'businesses',
      value: stats?.merchants ?? 0,
      label: t('home.stats.businesses', 'Businesses'),
      color: HOME_ACCENTS.business,
      icon: <Storefront sx={{ fontSize: 28, color: HOME_ACCENTS.business }} />,
    },
    {
      key: 'products',
      value: stats?.products ?? 0,
      label: t('home.stats.products', 'Products'),
      color: HOME_ACCENTS.info,
      icon: <Inventory2 sx={{ fontSize: 28, color: HOME_ACCENTS.info }} />,
    },
  ];
}

const StatsHeader: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const { t } = useTranslation();
  return (
    <Box sx={{ textAlign: 'center', mb: 4 }}>
      <LiveBadge reduceMotion={reduceMotion} />
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45 }}
      >
        <Typography
          variant="overline"
          sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.12em', display: 'block', mb: 1 }}
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
          animation: reduceMotion ? 'none' : 'communityLivePulse 1.8s ease-in-out infinite',
          '@keyframes communityLivePulse': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.4, transform: 'scale(1.45)' },
          },
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.06em' }}>
        {t('home.stats.liveLabel', 'Updates every few minutes')}
      </Typography>
    </Stack>
  );
};

const StatsGrid: React.FC<{ stats: StatDef[]; reduceMotion: boolean }> = ({
  stats,
  reduceMotion,
}) => (
  <Grid container spacing={2.5}>
    {stats.map((stat, i) => (
      <Grid key={stat.key} size={{ xs: 6, md: 3 }}>
        <StatCard stat={stat} delay={i * 0.08} reduceMotion={reduceMotion} />
      </Grid>
    ))}
  </Grid>
);

const StatCard: React.FC<{
  stat: StatDef;
  delay: number;
  reduceMotion: boolean;
}> = ({ stat, delay, reduceMotion }) => (
  <motion.div
    initial={{ opacity: 0, y: reduceMotion ? 0 : 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45, delay }}
  >
    <Card
      elevation={0}
      sx={{
        height: '100%',
        borderRadius: 3,
        border: `1.5px solid ${alpha(stat.color, 0.18)}`,
        bgcolor: 'background.paper',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 12px 28px ${alpha(stat.color, 0.16)}`,
        },
      }}
    >
      <CardContent sx={{ p: { xs: 2, md: 3 }, textAlign: 'center' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2.5,
            bgcolor: alpha(stat.color, 0.12),
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.5,
          }}
        >
          {stat.icon}
        </Box>
        <Typography
          component="p"
          sx={{
            fontSize: { xs: '1.7rem', md: '2.15rem' },
            fontWeight: 800,
            color: stat.color,
            lineHeight: 1.1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <AnimatedStatValue value={stat.value} />
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600, color: 'text.secondary' }}>
          {stat.label}
        </Typography>
      </CardContent>
    </Card>
  </motion.div>
);

function useAnimatedCount(value: number, reduceMotion: boolean): number {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 70, damping: 18 });
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value);
      return;
    }
    motionValue.set(value);
  }, [value, reduceMotion, motionValue]);

  useEffect(() => {
    if (reduceMotion) return undefined;
    return spring.on('change', (latest) => setDisplay(Math.round(latest)));
  }, [spring, reduceMotion]);

  return display;
}

const AnimatedStatValue: React.FC<{ value: number }> = ({ value }) => {
  const reduceMotion = Boolean(useReducedMotion());
  const count = useAnimatedCount(value, reduceMotion);
  return <>{count.toLocaleString()}</>;
};

const StatsSkeleton: React.FC = () => (
  <Grid container spacing={2.5}>
    {['clients', 'agents', 'businesses', 'products'].map((key) => (
      <Grid key={key} size={{ xs: 6, md: 3 }}>
        <Skeleton variant="rounded" height={168} sx={{ borderRadius: 3 }} />
      </Grid>
    ))}
  </Grid>
);

export default CommunityStatsSection;
