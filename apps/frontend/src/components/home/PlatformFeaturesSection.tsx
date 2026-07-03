import { AutoAwesome, Chat, LocationOn, Map, NotificationsActive, Pin } from '@mui/icons-material';
import { Box, Card, CardContent, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface FeatureTile {
  icon: React.ReactNode;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
  color: string;
  heroSize?: boolean;
}

const features: FeatureTile[] = [
  {
    icon: <Map sx={{ fontSize: 32, color: '#1e40af' }} />,
    titleKey: 'home.features.tracking.title',
    defaultTitle: 'Real-time delivery tracking',
    descKey: 'home.features.tracking.desc',
    defaultDesc: 'Watch your delivery move on a live map. Know the ETA before you even ask.',
    color: '#1e40af',
    heroSize: true,
  },
  {
    icon: <Pin sx={{ fontSize: 32, color: '#8b5cf6' }} />,
    titleKey: 'home.features.pin.title',
    defaultTitle: 'Secure delivery PIN',
    descKey: 'home.features.pin.desc',
    defaultDesc: 'Every delivery is confirmed with a 4-digit PIN — no PIN, no handover. Your order is always protected.',
    color: '#8b5cf6',
    heroSize: true,
  },
  {
    icon: <Chat sx={{ fontSize: 24, color: '#0891b2' }} />,
    titleKey: 'home.features.messaging.title',
    defaultTitle: 'In-app messaging',
    descKey: 'home.features.messaging.desc',
    defaultDesc: 'Chat instantly with the business or your delivery agent.',
    color: '#0891b2',
  },
  {
    icon: <AutoAwesome sx={{ fontSize: 24, color: '#f59e0b' }} />,
    titleKey: 'home.features.ai.title',
    defaultTitle: 'AI product descriptions',
    descKey: 'home.features.ai.desc',
    defaultDesc: 'Businesses can generate compelling product descriptions with AI in one click.',
    color: '#f59e0b',
  },
  {
    icon: <LocationOn sx={{ fontSize: 24, color: '#ef4444' }} />,
    titleKey: 'home.features.addresses.title',
    defaultTitle: 'Multiple delivery addresses',
    descKey: 'home.features.addresses.desc',
    defaultDesc: 'Save home, work, and custom addresses. Switch anytime before checkout.',
    color: '#ef4444',
  },
  {
    icon: <NotificationsActive sx={{ fontSize: 24, color: '#16a34a' }} />,
    titleKey: 'home.features.notifications.title',
    defaultTitle: 'Push notifications',
    descKey: 'home.features.notifications.desc',
    defaultDesc: 'Get instant updates on order status, delivery milestones, and messages.',
    color: '#16a34a',
  },
];

const FeatureIllustration: React.FC<{ titleKey: string; color: string }> = ({ titleKey, color }) => {
  const shouldReduce = useReducedMotion();
  if (titleKey.includes('tracking')) {
    return (
      <svg viewBox="0 0 240 120" style={{ width: '100%', maxWidth: 240, height: 'auto' }} aria-hidden="true">
        <rect width="240" height="120" rx="12" fill={alpha(color, 0.06)} />
        <line x1="0" y1="60" x2="240" y2="60" stroke="white" strokeWidth="8" />
        <line x1="120" y1="0" x2="120" y2="120" stroke="white" strokeWidth="8" />
        <path d="M 30 90 Q 80 50 130 55 Q 170 58 200 30" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <motion.circle
          cx="200" cy="30" r="8" fill={color}
          animate={shouldReduce ? {} : { scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        />
        <circle cx="30" cy="90" r="6" fill={alpha(color, 0.4)} />
        <text x="196" y="34" fill="white" fontSize="8">🛵</text>
      </svg>
    );
  }
  if (titleKey.includes('pin')) {
    return (
      <svg viewBox="0 0 240 120" style={{ width: '100%', maxWidth: 240, height: 'auto' }} aria-hidden="true">
        <rect width="240" height="120" rx="12" fill={alpha(color, 0.06)} />
        <rect x="70" y="25" width="100" height="70" rx="10" fill="white" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }} />
        <text x="120" y="48" textAnchor="middle" fill="#64748b" fontSize="9">Delivery PIN</text>
        <text x="120" y="76" textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">4 2 7 9</text>
        <text x="120" y="90" textAnchor="middle" fill="#94a3b8" fontSize="8">Scan to confirm</text>
      </svg>
    );
  }
  return null;
};

const PlatformFeaturesSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const heroFeatures = features.filter((f) => f.heroSize);
  const compactFeatures = features.filter((f) => !f.heroSize);

  return (
    <Box
      component="section"
      id="features"
      sx={{ py: { xs: 8, md: 14 }, bgcolor: 'background.default' }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <motion.div
            initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Typography
              component="h2"
              sx={{
                fontSize: { xs: '2rem', md: '2.75rem' },
                fontWeight: 800,
                letterSpacing: '-0.025em',
                lineHeight: 1.1,
                color: 'text.primary',
                mb: 2,
              }}
            >
              {t('home.features.title', 'A platform packed with power')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto' }}>
              {t('home.features.subtitle', 'Every feature designed to make shopping, selling, and delivery seamless.')}
            </Typography>
          </motion.div>
        </Box>

        {/* Hero tiles — tracking + PIN */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {heroFeatures.map((f, i) => (
            <Grid key={f.titleKey} size={{ xs: 12, md: 6 }}>
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                style={{ height: '100%' }}
              >
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: `1.5px solid ${alpha(f.color, 0.15)}`,
                    borderRadius: 3,
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: f.color,
                      boxShadow: `0 8px 24px ${alpha(f.color, 0.15)}`,
                    },
                  }}
                >
                  <Box sx={{ bgcolor: alpha(f.color, 0.05), p: 3, pb: 0 }}>
                    <FeatureIllustration titleKey={f.titleKey} color={f.color} />
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(f.color, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {f.icon}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{t(f.titleKey, f.defaultTitle)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                      {t(f.descKey, f.defaultDesc)}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        {/* Compact tiles */}
        <Grid container spacing={3}>
          {compactFeatures.map((f, i) => (
            <Grid key={f.titleKey} size={{ xs: 12, sm: 6, md: 3 }}>
              <motion.div
                initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                style={{ height: '100%' }}
              >
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: `1.5px solid`,
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.25s ease',
                    '&:hover': { borderColor: f.color, boxShadow: `0 4px 16px ${alpha(f.color, 0.12)}` },
                  }}
                >
                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: alpha(f.color, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                      {f.icon}
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.75 }}>{t(f.titleKey, f.defaultTitle)}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.65, fontSize: '0.825rem' }}>
                      {t(f.descKey, f.defaultDesc)}
                    </Typography>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default PlatformFeaturesSection;
