import { ArrowForward, ShoppingBag } from '@mui/icons-material';
import { Box, Button, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { marketingGradients } from '../../theme/themeUtils';
import AppStoreBadges from '../common/AppStoreBadges';

const PhoneMockupIllustration: React.FC = () => {
  const shouldReduce = useReducedMotion();
  return (
    <motion.div
      animate={shouldReduce ? {} : { y: [0, -12, 0] }}
      transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
      style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
    >
      <svg
        viewBox="0 0 320 580"
        style={{ width: '100%', maxWidth: 280, height: 'auto', filter: 'drop-shadow(0 32px 80px rgba(0,0,0,0.35))' }}
        aria-hidden="true"
      >
        {/* Phone frame */}
        <rect x="10" y="0" width="300" height="580" rx="38" fill="#0f172a" />
        <rect x="18" y="8" width="284" height="564" rx="32" fill="#1e293b" />
        {/* Screen */}
        <rect x="18" y="8" width="284" height="564" rx="32" fill="#f8fafc" />
        {/* Status bar */}
        <rect x="18" y="8" width="284" height="44" rx="32" fill="#1e40af" />
        <rect x="18" y="36" width="284" height="16" fill="#1e40af" />
        {/* Notch */}
        <rect x="110" y="8" width="100" height="28" rx="14" fill="#0f172a" />
        {/* App header */}
        <rect x="18" y="52" width="284" height="48" fill="#1e40af" />
        <text x="34" y="82" fill="white" fontSize="14" fontWeight="bold">Rendasua</text>
        <circle cx="272" cy="76" r="14" fill="rgba(255,255,255,0.2)" />
        <text x="265" y="81" fill="white" fontSize="12">🔔</text>
        {/* Map area */}
        <rect x="18" y="100" width="284" height="180" fill="#e2e8f0" />
        {/* Roads */}
        <line x1="100" y1="100" x2="100" y2="280" stroke="white" strokeWidth="8" />
        <line x1="18" y1="190" x2="302" y2="190" stroke="white" strokeWidth="8" />
        <line x1="200" y1="100" x2="200" y2="280" stroke="white" strokeWidth="4" strokeDasharray="10,6" />
        {/* Delivery route */}
        <path d="M 80 240 Q 130 200 180 210 Q 220 218 240 180" stroke="#1e40af" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* Agent pin */}
        <circle cx="80" cy="240" r="14" fill="#1e40af" />
        <text x="75" y="245" fill="white" fontSize="12">🛵</text>
        {/* Destination pin */}
        <circle cx="240" cy="180" r="14" fill="#16a34a" />
        <text x="234" y="185" fill="white" fontSize="12">🏠</text>
        {/* Order card */}
        <rect x="26" y="292" width="268" height="88" rx="12" fill="white" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.08))' }} />
        <circle cx="50" cy="322" r="16" fill={alpha('#16a34a', 0.15)} />
        <text x="42" y="327" fontSize="14">📦</text>
        <text x="74" y="316" fill="#1d1d1f" fontSize="11" fontWeight="bold">Your order is on the way</text>
        <text x="74" y="330" fill="#86868b" fontSize="10">ETA 8 min · Agent: Jean</text>
        <rect x="200" y="308" width="80" height="28" rx="8" fill="#1e40af" />
        <text x="220" y="326" fill="white" fontSize="10" fontWeight="bold">Track</text>
        {/* Chat card */}
        <rect x="26" y="390" width="160" height="60" rx="12" fill="white" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }} />
        <text x="38" y="412" fill="#86868b" fontSize="9">Jean (Agent)</text>
        <rect x="38" y="418" width="100" height="22" rx="6" fill="#f1f5f9" />
        <text x="46" y="433" fill="#1d1d1f" fontSize="10">Almost there! 🎉</text>
        {/* PIN card */}
        <rect x="196" y="390" width="100" height="60" rx="12" fill="#1e40af" />
        <text x="215" y="412" fill="rgba(255,255,255,0.8)" fontSize="9">Delivery PIN</text>
        <text x="210" y="435" fill="white" fontSize="18" fontWeight="bold">4 2 7 9</text>
        {/* Bottom nav */}
        <rect x="18" y="528" width="284" height="44" rx="0" fill="white" />
        <rect x="18" y="528" width="284" height="2" fill="#e2e8f0" />
        {['🏠','🛍️','📋','💬','👤'].map((icon, i) => (
          <text key={i} x={46 + i * 56} y="556" fontSize="16" textAnchor="middle" fill={i === 0 ? '#1e40af' : '#86868b'}>{icon}</text>
        ))}
      </svg>
    </motion.div>
  );
};

const HeroSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  const fadeProps = (delay = 0) => ({
    initial: { opacity: 0, y: shouldReduce ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: 'easeOut' as const },
  });

  return (
    <Box
      component="section"
      sx={{
        background: marketingGradients.hero,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: marketingGradients.heroOverlay,
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={4} alignItems="center" sx={{ py: { xs: 8, md: 12 } }}>
          {/* Left — copy */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <motion.div {...fadeProps(0)}>
                <Typography
                  component="span"
                  sx={{
                    display: 'inline-block',
                    bgcolor: 'rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    px: 2,
                    py: 0.5,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    mb: 3,
                  }}
                >
                  {t('home.hero.eyebrow', 'Now available on iOS & Android')}
                </Typography>
              </motion.div>

              <motion.div {...fadeProps(0.1)}>
                <Typography
                  component="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', sm: '3.25rem', md: '4rem' },
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.05,
                    color: '#fff',
                    mb: 3,
                  }}
                >
                  {t('home.hero.headline', 'Everything local,')}
                  <Box component="span" sx={{ display: 'block', color: 'rgba(255,255,255,0.85)' }}>
                    {t('home.hero.headlineLine2', 'delivered.')}
                  </Box>
                </Typography>
              </motion.div>

              <motion.div {...fadeProps(0.2)}>
                <Typography
                  variant="h6"
                  component="p"
                  sx={{
                    color: 'rgba(255,255,255,0.82)',
                    fontWeight: 400,
                    fontSize: { xs: '1rem', md: '1.15rem' },
                    lineHeight: 1.65,
                    mb: 4,
                    maxWidth: 520,
                    mx: { xs: 'auto', md: 0 },
                  }}
                >
                  {t(
                    'home.hero.subheadline',
                    'Browse local businesses, order in minutes, and track every delivery in real time — or open a storefront and start selling today.'
                  )}
                </Typography>
              </motion.div>

              <motion.div {...fadeProps(0.3)}>
                <Box sx={{ mb: 3 }}>
                  <AppStoreBadges variant="default" sourceSection="hero" />
                </Box>
              </motion.div>

              <motion.div {...fadeProps(0.4)}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{ justifyContent: { xs: 'center', md: 'flex-start' } }}
                >
                  <Button
                    component={RouterLink}
                    to="/items"
                    variant="outlined"
                    startIcon={<ShoppingBag />}
                    sx={{
                      color: '#fff',
                      borderColor: 'rgba(255,255,255,0.45)',
                      borderWidth: 2,
                      fontWeight: 600,
                      '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)', borderWidth: 2 },
                    }}
                  >
                    {t('home.hero.browseItems', 'Browse Items')}
                  </Button>
                  <Button
                    component={RouterLink}
                    to="/signup?intent=business_sell"
                    variant="text"
                    endIcon={<ArrowForward />}
                    sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600, '&:hover': { color: '#fff', bgcolor: 'transparent' } }}
                  >
                    {t('home.hero.sellOnRendasua', 'Sell on Rendasua')}
                  </Button>
                </Stack>
              </motion.div>
            </Box>
          </Grid>

          {/* Right — phone mockup */}
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, scale: shouldReduce ? 1 : 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <PhoneMockupIllustration />
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default HeroSection;
