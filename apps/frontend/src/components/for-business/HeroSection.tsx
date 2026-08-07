import { ArrowForward } from '@mui/icons-material';
import { Box, Button, Container, Grid, Stack, Typography } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import MockScreenCard from './MockScreenCard';
import {
  FB_GREEN,
  FB_HERO_GRADIENT,
  SIGNUP_RENT,
  SIGNUP_SELL,
} from './forBusinessTheme';

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      sx={{
        background: FB_HERO_GRADIENT,
        position: 'relative',
        overflow: 'hidden',
        py: { xs: 8, md: 12 },
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 70% 30%, rgba(16,185,129,0.2) 0%, transparent 55%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: shouldReduce ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Typography
                variant="overline"
                sx={{
                  color: 'rgba(255,255,255,0.75)',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  mb: 2,
                  display: 'block',
                }}
              >
                {t('forBusiness.hero.eyebrow', 'For businesses')}
              </Typography>
              <Typography
                component="h1"
                sx={{
                  fontSize: { xs: '2.25rem', md: '3.25rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.08,
                  color: '#fff',
                  mb: 2.5,
                }}
              >
                {t(
                  'forBusiness.hero.headline',
                  'Sell to more local customers — without building a website.'
                )}
              </Typography>
              <Typography
                variant="h6"
                component="p"
                sx={{
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 400,
                  mb: 2,
                  lineHeight: 1.65,
                  fontSize: { xs: '1rem', md: '1.15rem' },
                }}
              >
                {t(
                  'forBusiness.hero.subheadline',
                  'Rendasua gives you a storefront, secure payments, AI listings, and delivery agents — ready in under 5 minutes.'
                )}
              </Typography>
              <Stack
                direction="row"
                flexWrap="wrap"
                useFlexGap
                spacing={1}
                sx={{ mb: 3.5 }}
              >
                {[
                  t('forBusiness.hero.pill1', 'No website required'),
                  t('forBusiness.hero.pill2', 'Delivery handled'),
                  t('forBusiness.hero.pill3', 'Secure payments'),
                  t('forBusiness.hero.pill4', 'AI listings'),
                ].map((pill) => (
                  <Box
                    key={pill}
                    sx={{
                      px: 1.25,
                      py: 0.5,
                      borderRadius: 999,
                      bgcolor: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {pill}
                  </Box>
                ))}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button
                  component={RouterLink}
                  to={SIGNUP_SELL}
                  variant="contained"
                  size="large"
                  endIcon={<ArrowForward />}
                  sx={{
                    bgcolor: 'white',
                    color: FB_GREEN,
                    fontWeight: 700,
                    px: 3.5,
                    '&:hover': { bgcolor: 'grey.50' },
                  }}
                >
                  {t(
                    'forBusiness.cta.primary',
                    'Create my store for free'
                  )}
                </Button>
                <Button
                  component={RouterLink}
                  to={SIGNUP_RENT}
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: 'rgba(255,255,255,0.5)',
                    color: '#fff',
                    fontWeight: 600,
                    borderWidth: 2,
                    '&:hover': { borderColor: '#fff', borderWidth: 2 },
                  }}
                >
                  {t('forBusiness.hero.rentalCta', 'Open Rental Account')}
                </Button>
                <Button
                  href="#dashboard-showcase"
                  variant="text"
                  size="large"
                  sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}
                >
                  {t('forBusiness.hero.demoCta', 'See a demo')}
                </Button>
              </Stack>
            </motion.div>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.1 }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <MockScreenCard
                  kind="dashboard"
                  title={t(
                    'forBusiness.showcase.dashboard',
                    'Merchant dashboard'
                  )}
                />
              </Box>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default HeroSection;
