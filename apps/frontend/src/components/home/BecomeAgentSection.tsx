import { CheckCircle } from '@mui/icons-material';
import { Box, Button, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import AppStoreBadges from '../common/AppStoreBadges';

const agentBenefits = [
  { key: 'home.agent.benefits.flexible', defaultLabel: 'Flexible hours — work when you want' },
  { key: 'home.agent.benefits.navigation', defaultLabel: 'Efficient in-app navigation' },
  { key: 'home.agent.benefits.chat', defaultLabel: 'Chat with businesses and customers' },
  { key: 'home.agent.benefits.pin', defaultLabel: 'Secure delivery PIN verification' },
  { key: 'home.agent.benefits.tracking', defaultLabel: 'Full delivery history & tracking' },
  { key: 'home.agent.benefits.earn', defaultLabel: 'Earn per delivery — no caps' },
];

const BecomeAgentSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      id="become-agent"
      sx={{
        py: { xs: 8, md: 14 },
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%)',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 80% 50%, rgba(8,145,178,0.15) 0%, transparent 55%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} alignItems="center">
          {/* Agent illustration */}
          <Grid size={{ xs: 12, md: 5 }}>
            <motion.div
              initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <svg viewBox="0 0 300 260" style={{ width: '100%', maxWidth: 280 }} aria-hidden="true">
                  {/* Map background */}
                  <rect width="300" height="260" rx="16" fill={alpha('#0891b2', 0.08)} />
                  <line x1="0" y1="130" x2="300" y2="130" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  <line x1="150" y1="0" x2="150" y2="260" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
                  {/* Route */}
                  <path d="M 50 200 Q 120 150 180 140 Q 230 130 260 80" stroke="#0891b2" strokeWidth="3" fill="none" strokeLinecap="round" />
                  {/* Agent */}
                  <motion.g
                    animate={shouldReduce ? {} : { x: [0, 10, 20, 30, 40], y: [0, -10, -20, -25, -30] }}
                    transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  >
                    <circle cx="50" cy="200" r="20" fill="#0891b2" />
                    <text x="38" y="207" fill="white" fontSize="16">🛵</text>
                  </motion.g>
                  {/* Destination */}
                  <circle cx="260" cy="80" r="18" fill="#16a34a" />
                  <text x="248" y="87" fill="white" fontSize="14">📦</text>
                  {/* Earnings card */}
                  <rect x="60" y="20" width="130" height="60" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
                  <text x="75" y="42" fill="rgba(255,255,255,0.6)" fontSize="9">Today's earnings</text>
                  <text x="75" y="62" fill="white" fontSize="18" fontWeight="bold">12,500 XAF</text>
                </svg>
              </Box>
            </motion.div>
          </Grid>

          {/* Content */}
          <Grid size={{ xs: 12, md: 7 }}>
            <motion.div
              initial={{ opacity: 0, x: shouldReduce ? 0 : 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <Typography
                variant="overline"
                sx={{ color: '#0891b2', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}
              >
                {t('home.agent.eyebrow', 'For delivery agents')}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.875rem', md: '2.5rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  color: '#fff',
                  mb: 2,
                }}
              >
                {t('home.agent.title', 'Deliver on your schedule.')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.72)', mb: 4, lineHeight: 1.7 }}>
                {t('home.agent.subtitle', 'Join the Rendasua delivery network. Set your own hours, accept orders near you, and earn money on your terms.')}
              </Typography>

              <Grid container spacing={1.5} sx={{ mb: 4 }}>
                {agentBenefits.map((b) => (
                  <Grid key={b.key} size={{ xs: 12, sm: 6 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle sx={{ fontSize: 18, color: '#0891b2', flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>
                        {t(b.key, b.defaultLabel)}
                      </Typography>
                    </Stack>
                  </Grid>
                ))}
              </Grid>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} flexWrap="wrap">
                <AppStoreBadges variant="dark" sourceSection="become_agent" />
                <Button
                  component={RouterLink}
                  to="/become-a-delivery-agent"
                  variant="text"
                  sx={{ color: 'rgba(255,255,255,0.65)', fontWeight: 600, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                >
                  {t('home.agent.learnMore', 'Learn more')}
                </Button>
              </Stack>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default BecomeAgentSection;
