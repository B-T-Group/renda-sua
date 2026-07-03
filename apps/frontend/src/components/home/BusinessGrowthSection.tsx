import { ArrowForward, AutoAwesome, BarChart, Inventory, LocalShipping, People } from '@mui/icons-material';
import { Box, Button, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';

const businessFeatures = [
  { icon: <Inventory sx={{ fontSize: 22, color: '#16a34a' }} />, key: 'home.businessGrowth.features.inventory', defaultLabel: 'Inventory management across locations' },
  { icon: <AutoAwesome sx={{ fontSize: 22, color: '#f59e0b' }} />, key: 'home.businessGrowth.features.ai', defaultLabel: 'AI-assisted product descriptions' },
  { icon: <LocalShipping sx={{ fontSize: 22, color: '#1e40af' }} />, key: 'home.businessGrowth.features.delivery', defaultLabel: 'Order & delivery management' },
  { icon: <People sx={{ fontSize: 22, color: '#0891b2' }} />, key: 'home.businessGrowth.features.messaging', defaultLabel: 'In-app customer messaging' },
  { icon: <BarChart sx={{ fontSize: 22, color: '#8b5cf6' }} />, key: 'home.businessGrowth.features.analytics', defaultLabel: 'Business analytics & growth' },
];

const BusinessGrowthSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      id="for-business"
      sx={{ py: { xs: 8, md: 14 }, bgcolor: 'background.paper' }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          {/* Illustration */}
          <Grid size={{ xs: 12, md: 5 }}>
            <motion.div
              initial={{ opacity: 0, x: shouldReduce ? 0 : -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <svg viewBox="0 0 320 280" style={{ width: '100%', maxWidth: 300 }} aria-hidden="true">
                  {/* Store */}
                  <rect x="40" y="80" width="240" height="160" rx="14" fill={alpha('#16a34a', 0.07)} stroke={alpha('#16a34a', 0.2)} strokeWidth="1.5" />
                  <rect x="40" y="56" width="240" height="24" rx="0" fill="#16a34a" />
                  <rect x="40" y="56" width="240" height="12" rx="14" fill="#16a34a" />
                  <text x="160" y="73" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Your Business</text>
                  {/* Revenue bar chart */}
                  {[60, 80, 50, 90, 70, 100].map((h, i) => (
                    <rect key={i} x={55 + i * 34} y={240 - h} width="22" height={h} rx="4" fill={alpha('#16a34a', 0.2 + i * 0.1)} />
                  ))}
                  {/* Growth arrow */}
                  <path d="M 55 200 Q 160 160 265 100" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeDasharray="0" />
                  <path d="M 255 95 L 265 100 L 260 110" stroke="#16a34a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                  {/* AI badge */}
                  <rect x="188" y="95" width="80" height="28" rx="8" fill="#f59e0b" />
                  <text x="228" y="113" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">✨ AI powered</text>
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
                sx={{ color: '#16a34a', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}
              >
                {t('home.businessGrowth.eyebrow', 'For businesses')}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '1.875rem', md: '2.5rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.025em',
                  lineHeight: 1.1,
                  color: 'text.primary',
                  mb: 2,
                }}
              >
                {t('home.businessGrowth.title', 'Your storefront, online in minutes.')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7 }}>
                {t(
                  'home.businessGrowth.subtitle',
                  'Join hundreds of local businesses already selling on Rendasua. Set up your storefront, manage inventory, and start receiving orders from customers in your city — all from one dashboard.'
                )}
              </Typography>

              {/* Features */}
              <Stack spacing={1.5} sx={{ mb: 4 }}>
                {businessFeatures.map((f) => (
                  <Stack key={f.key} direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: alpha('#16a34a', 0.08), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {f.icon}
                    </Box>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                      {t(f.key, f.defaultLabel)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              {/* CTAs */}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  component={RouterLink}
                  to="/signup?intent=business_sell"
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{ bgcolor: '#16a34a', fontWeight: 700, px: 3, '&:hover': { bgcolor: '#15803d' } }}
                >
                  {t('home.businessGrowth.cta', 'Create Business Account')}
                </Button>
                <Button
                  component={RouterLink}
                  to="/for-business"
                  variant="outlined"
                  size="large"
                  sx={{ borderColor: '#16a34a', color: '#16a34a', fontWeight: 600, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                >
                  {t('home.businessGrowth.secondaryCta', 'Learn more')}
                </Button>
              </Stack>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default BusinessGrowthSection;
