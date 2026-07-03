import { CheckCircle } from '@mui/icons-material';
import { Box, Container, Grid, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';
import AppStoreBadges from '../common/AppStoreBadges';
import { marketingGradients } from '../../theme/themeUtils';

const downloadBenefits = [
  { key: 'home.download.benefits.tracking', defaultLabel: 'Real-time order tracking on a live map' },
  { key: 'home.download.benefits.notifications', defaultLabel: 'Instant push notifications for every update' },
  { key: 'home.download.benefits.pin', defaultLabel: 'Secure delivery PIN verification' },
  { key: 'home.download.benefits.checkout', defaultLabel: 'Faster checkout with saved addresses' },
];

const DownloadAppSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      id="download"
      sx={{
        py: { xs: 10, md: 16 },
        background: marketingGradients.download,
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.12) 0%, transparent 50%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
        <Grid container spacing={6} alignItems="center" justifyContent="center">
          {/* Content */}
          <Grid size={{ xs: 12, md: 6 }}>
            <motion.div
              initial={{ opacity: 0, y: shouldReduce ? 0 : 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55 }}
            >
              <Typography
                variant="overline"
                sx={{ color: '#60a5fa', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}
              >
                {t('home.download.eyebrow', 'Available now')}
              </Typography>
              <Typography
                component="h2"
                sx={{
                  fontSize: { xs: '2rem', sm: '2.75rem', md: '3.25rem' },
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  lineHeight: 1.05,
                  color: '#fff',
                  mb: 3,
                }}
              >
                {t('home.download.title', 'Rendasua works better in the app.')}
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.72)', mb: 4, lineHeight: 1.7 }}>
                {t('home.download.subtitle', 'Download the free app and unlock the full Rendasua experience — for shoppers, businesses, and delivery agents.')}
              </Typography>

              {/* Benefits */}
              <Stack spacing={1.5} sx={{ mb: 5 }}>
                {downloadBenefits.map((b) => (
                  <Stack key={b.key} direction="row" spacing={1.5} alignItems="center">
                    <CheckCircle sx={{ fontSize: 18, color: '#60a5fa', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500 }}>
                      {t(b.key, b.defaultLabel)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <AppStoreBadges variant="withQr" sourceSection="download_flagship" />
            </motion.div>
          </Grid>

          {/* Phone mockup */}
          <Grid size={{ xs: 12, md: 5 }} sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: shouldReduce ? 0 : 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: 0.15 }}
            >
              <motion.div
                animate={shouldReduce ? {} : { y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
              >
                <svg viewBox="0 0 260 500" style={{ width: 220, height: 'auto', filter: 'drop-shadow(0 32px 80px rgba(0,0,0,0.5))' }} aria-hidden="true">
                  <rect x="8" y="0" width="244" height="500" rx="34" fill="#0f172a" />
                  <rect x="16" y="8" width="228" height="484" rx="28" fill="#1e293b" />
                  <rect x="16" y="8" width="228" height="484" rx="28" fill="#f8fafc" />
                  <rect x="16" y="8" width="228" height="44" rx="28" fill="#1e40af" />
                  <rect x="16" y="36" width="228" height="16" fill="#1e40af" />
                  <rect x="88" y="8" width="84" height="24" rx="12" fill="#0f172a" />
                  <rect x="16" y="52" width="228" height="40" fill="#1e40af" />
                  <text x="35" y="77" fill="white" fontSize="13" fontWeight="bold">Rendasua</text>
                  {/* Order tracking map */}
                  <rect x="16" y="92" width="228" height="160" fill="#e2e8f0" />
                  <line x1="80" y1="92" x2="80" y2="252" stroke="white" strokeWidth="7" />
                  <line x1="16" y1="172" x2="244" y2="172" stroke="white" strokeWidth="7" />
                  <path d="M 50 220 Q 100 180 160 170 Q 200 165 220 130" stroke="#1e40af" strokeWidth="2.5" fill="none" />
                  <circle cx="50" cy="220" r="12" fill="#1e40af" />
                  <text x="43" y="225" fill="white" fontSize="10">🛵</text>
                  <circle cx="220" cy="130" r="12" fill="#16a34a" />
                  <text x="213" y="135" fill="white" fontSize="10">🏠</text>
                  {/* Status card */}
                  <rect x="24" y="260" width="212" height="68" rx="10" fill="white" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.06))' }} />
                  <text x="44" y="282" fill="#1d1d1f" fontSize="10" fontWeight="bold">On the way · ETA 6 min</text>
                  <text x="44" y="296" fill="#86868b" fontSize="9">Agent Jean is 0.8km away</text>
                  <rect x="162" y="268" width="60" height="22" rx="6" fill="#1e40af" />
                  <text x="192" y="282" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold">Track</text>
                  <rect x="44" y="304" width="172" height="16" rx="4" fill="#f1f5f9" />
                  <rect x="44" y="304" width="110" height="16" rx="4" fill={alpha('#16a34a', 0.3)} />
                  {/* PIN card */}
                  <rect x="24" y="338" width="100" height="56" rx="10" fill="#1e40af" />
                  <text x="74" y="358" textAnchor="middle" fill="rgba(255,255,255,0.75)" fontSize="9">Delivery PIN</text>
                  <text x="74" y="378" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">4279</text>
                  {/* Chat card */}
                  <rect x="136" y="338" width="100" height="56" rx="10" fill="white" style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.06))' }} />
                  <text x="152" y="358" fill="#86868b" fontSize="8">Jean (Agent)</text>
                  <rect x="148" y="364" width="76" height="20" rx="6" fill="#f1f5f9" />
                  <text x="156" y="377" fill="#1d1d1f" fontSize="8">Almost there! 🎉</text>
                  {/* Bottom nav */}
                  <rect x="16" y="460" width="228" height="36" fill="white" />
                  <rect x="16" y="460" width="228" height="1.5" fill="#e2e8f0" />
                  {['🏠','🛍️','📋','💬'].map((icon, i) => (
                    <text key={i} x={38 + i * 56} y="484" fontSize="14" textAnchor="middle">{icon}</text>
                  ))}
                </svg>
              </motion.div>
            </motion.div>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default DownloadAppSection;
