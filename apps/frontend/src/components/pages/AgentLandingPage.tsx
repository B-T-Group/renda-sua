import { CheckCircle } from '@mui/icons-material';
import { Box, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEOHead } from '../seo';
import { useSEO } from '../../hooks/useSEO';
import AppStoreBadges from '../common/AppStoreBadges';

const benefits = [
  { key: 'becomeAgent.benefits.flexible', defaultLabel: 'Flexible hours — work when it suits you' },
  { key: 'becomeAgent.benefits.earn', defaultLabel: 'Earn per delivery with no income caps' },
  { key: 'becomeAgent.benefits.navigation', defaultLabel: 'Efficient in-app navigation to every pickup and drop-off' },
  { key: 'becomeAgent.benefits.chat', defaultLabel: 'Chat with businesses and customers in real time' },
  { key: 'becomeAgent.benefits.pin', defaultLabel: 'Secure delivery PIN — every handover is verified' },
  { key: 'becomeAgent.benefits.tracking', defaultLabel: 'Full delivery history and earnings tracking' },
];

const steps = [
  { step: '1', titleKey: 'becomeAgent.steps.download.title', defaultTitle: 'Download the app', descKey: 'becomeAgent.steps.download.desc', defaultDesc: 'Get the Rendasua app on iOS or Android.' },
  { step: '2', titleKey: 'becomeAgent.steps.signup.title', defaultTitle: 'Sign up as an agent', descKey: 'becomeAgent.steps.signup.desc', defaultDesc: 'Create your account and select "Delivery Agent" as your role.' },
  { step: '3', titleKey: 'becomeAgent.steps.start.title', defaultTitle: 'Start delivering', descKey: 'becomeAgent.steps.start.desc', defaultDesc: 'Complete onboarding in the app and start accepting delivery requests near you.' },
];

const AgentLandingPage: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const seoConfig = useSEO({
    title: t('becomeAgent.seo.title', 'Become a Delivery Agent — Rendasua'),
    description: t('becomeAgent.seo.description', 'Earn money by delivering orders on your own schedule. Join the Rendasua delivery network and start accepting delivery requests near you.'),
    keywords: t('becomeAgent.seo.keywords', 'delivery agent, earn money, flexible work, delivery job, Rendasua agent, become a driver'),
    type: 'website',
    canonical: 'https://rendasua.com/become-a-delivery-agent',
  });

  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <SEOHead {...seoConfig} />

      {/* Hero */}
      <Box
        component="section"
        sx={{
          background: 'linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #0369a1 70%, #0284c7 100%)',
          position: 'relative',
          overflow: 'hidden',
          py: { xs: 10, md: 16 },
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 30% 60%, rgba(14,165,233,0.2) 0%, transparent 55%)',
            pointerEvents: 'none',
          },
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div initial={{ opacity: 0, x: shouldReduce ? 0 : -24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55 }}>
                <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.75)', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}>
                  {t('becomeAgent.hero.eyebrow', 'For delivery agents')}
                </Typography>
                <Typography component="h1" sx={{ fontSize: { xs: '2.5rem', md: '3.5rem' }, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#fff', mb: 3 }}>
                  {t('becomeAgent.hero.headline', 'Deliver on your schedule. Earn on your terms.')}
                </Typography>
                <Typography variant="h6" component="p" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 400, mb: 5, lineHeight: 1.65 }}>
                  {t('becomeAgent.hero.subheadline', 'Join the Rendasua delivery network and start earning by delivering orders from local businesses to customers near you. No fixed shifts, no minimum hours.')}
                </Typography>
                <AppStoreBadges variant="dark" sourceSection="agent_landing_hero" />
              </motion.div>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <motion.div
                initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.65, delay: 0.15 }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <svg viewBox="0 0 300 260" style={{ width: '100%', maxWidth: 280 }} aria-hidden="true">
                    <rect width="300" height="260" rx="16" fill={alpha('#0891b2', 0.1)} />
                    <line x1="0" y1="130" x2="300" y2="130" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                    <line x1="150" y1="0" x2="150" y2="260" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
                    <path d="M 40 200 Q 100 150 180 140 Q 240 132 270 80" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" fill="none" strokeDasharray="6,4" />
                    <circle cx="40" cy="200" r="20" fill="#0891b2" />
                    <text x="28" y="207" fill="white" fontSize="16">🛵</text>
                    <circle cx="270" cy="80" r="18" fill="#16a34a" />
                    <text x="258" y="87" fill="white" fontSize="14">📦</text>
                    <rect x="50" y="20" width="140" height="60" rx="10" fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                    <text x="65" y="42" fill="rgba(255,255,255,0.6)" fontSize="9">Today's earnings</text>
                    <text x="65" y="64" fill="white" fontSize="20" fontWeight="bold">18,500 XAF</text>
                    <rect x="60" y="150" width="180" height="60" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                    <text x="80" y="172" fill="white" fontSize="11" fontWeight="bold">New delivery request!</text>
                    <text x="80" y="188" fill="rgba(255,255,255,0.65)" fontSize="9">2.1 km away · Est. 12 min</text>
                    <rect x="160" y="160" width="64" height="28" rx="8" fill="#16a34a" />
                    <text x="192" y="178" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Accept</text>
                  </svg>
                </Box>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Benefits */}
      <Box component="section" sx={{ py: { xs: 8, md: 14 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.025em', mb: 2 }}>
              {t('becomeAgent.benefits.title', 'Why deliver with Rendasua?')}
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {benefits.map((b, i) => (
              <Grid key={b.key} size={{ xs: 12, sm: 6, md: 4 }}>
                <motion.div
                  initial={{ opacity: 0, y: shouldReduce ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, border: '1.5px solid', borderColor: 'divider', borderRadius: 2.5 }}>
                    <CheckCircle sx={{ fontSize: 20, color: '#0891b2', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {t(b.key, b.defaultLabel)}
                    </Typography>
                  </Stack>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Steps */}
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.025em', mb: 2 }}>
              {t('becomeAgent.steps.title', 'How to get started')}
            </Typography>
          </Box>
          <Grid container spacing={4}>
            {steps.map((s, i) => (
              <Grid key={s.step} size={{ xs: 12, md: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Box sx={{ width: 52, height: 52, borderRadius: '50%', bgcolor: '#0891b2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.25rem', mx: 'auto', mb: 2 }}>
                    {s.step}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{t(s.titleKey, s.defaultTitle)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(s.descKey, s.defaultDesc)}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Final CTA */}
      <Box component="section" sx={{ py: { xs: 8, md: 12 }, bgcolor: alpha('#0891b2', 0.05) }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography component="h2" sx={{ fontSize: { xs: '1.875rem', md: '2.5rem' }, fontWeight: 800, letterSpacing: '-0.02em', mb: 2 }}>
              {t('becomeAgent.cta.title', 'Ready to start delivering?')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
              {t('becomeAgent.cta.subtitle', 'Download the app and start earning today.')}
            </Typography>
            <AppStoreBadges variant="withQr" sourceSection="agent_landing_cta" />
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default AgentLandingPage;
