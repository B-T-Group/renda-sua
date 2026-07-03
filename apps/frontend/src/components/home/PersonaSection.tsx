import { ArrowForward, CheckCircle } from '@mui/icons-material';
import { Box, Button, Container, Grid, Stack, Tab, Tabs, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import AppStoreBadges from '../common/AppStoreBadges';
import { personaContentData } from './data/personaContent';
import { useTrackSiteEvent, SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK } from '../../hooks/useTrackSiteEvent';

const PersonaIllustration: React.FC<{ id: 'client' | 'business' | 'agent'; color: string }> = ({ id, color }) => {
  return (
    <svg viewBox="0 0 300 220" style={{ width: '100%', maxWidth: 280, height: 'auto' }} aria-hidden="true">
      {id === 'client' && (
        <>
          <rect x="60" y="40" width="180" height="140" rx="16" fill={alpha(color, 0.08)} stroke={alpha(color, 0.2)} strokeWidth="1.5" />
          <text x="150" y="85" textAnchor="middle" fontSize="36">🛍️</text>
          <rect x="80" y="105" width="140" height="12" rx="4" fill={alpha(color, 0.15)} />
          <rect x="80" y="124" width="100" height="10" rx="4" fill={alpha(color, 0.1)} />
          <rect x="80" y="148" width="140" height="22" rx="8" fill={color} />
          <text x="150" y="163" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">Order Now</text>
        </>
      )}
      {id === 'business' && (
        <>
          <rect x="40" y="20" width="220" height="170" rx="16" fill={alpha(color, 0.08)} stroke={alpha(color, 0.2)} strokeWidth="1.5" />
          <rect x="40" y="20" width="220" height="40" rx="16" fill={color} />
          <rect x="40" y="44" width="220" height="16" fill={color} />
          <text x="150" y="46" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">Business Dashboard</text>
          <text x="60" y="85" fontSize="11" fill="#64748b">Orders today</text>
          <text x="220" y="85" textAnchor="end" fontSize="16" fontWeight="bold" fill={color}>24</text>
          <rect x="56" y="92" width="188" height="1" fill="#e2e8f0" />
          <text x="60" y="115" fontSize="11" fill="#64748b">Revenue</text>
          <text x="220" y="115" textAnchor="end" fontSize="14" fontWeight="bold" fill={color}>45,000 XAF</text>
          <rect x="56" y="122" width="188" height="1" fill="#e2e8f0" />
          <text x="60" y="145" fontSize="11" fill="#64748b">Active items</text>
          <text x="220" y="145" textAnchor="end" fontSize="14" fontWeight="bold" fill={color}>18</text>
          <rect x="60" y="158" width="80" height="20" rx="6" fill={alpha(color, 0.12)} />
          <text x="100" y="172" textAnchor="middle" fill={color} fontSize="10" fontWeight="bold">+ Add item</text>
          <rect x="152" y="158" width="88" height="20" rx="6" fill={color} />
          <text x="196" y="172" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">View orders</text>
        </>
      )}
      {id === 'agent' && (
        <>
          <rect x="30" y="20" width="240" height="170" rx="16" fill={alpha(color, 0.07)} />
          {/* Map */}
          <line x1="30" y1="100" x2="270" y2="100" stroke="white" strokeWidth="10" />
          <line x1="150" y1="20" x2="150" y2="190" stroke="white" strokeWidth="10" />
          <rect x="30" y="20" width="240" height="170" rx="16" fill="none" stroke={alpha(color, 0.2)} strokeWidth="1.5" />
          <path d="M 80 130 Q 130 90 190 80 Q 230 75 240 60" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
          <circle cx="80" cy="130" r="14" fill={color} />
          <text x="74" y="135" fill="white" fontSize="12">🛵</text>
          <circle cx="240" cy="60" r="14" fill="#16a34a" />
          <text x="234" y="65" fill="white" fontSize="12">📦</text>
          <rect x="60" y="152" width="180" height="30" rx="10" fill="white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }} />
          <text x="90" y="165" fill="#1d1d1f" fontSize="10" fontWeight="bold">Delivery #4821</text>
          <text x="90" y="178" fill="#86868b" fontSize="9">ETA 5 min</text>
          <rect x="205" y="157" width="28" height="20" rx="5" fill={color} />
          <text x="219" y="170" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">NAV</text>
        </>
      )}
    </svg>
  );
};

const PersonaSection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();
  const [activeTab, setActiveTab] = useState(0);
  const { trackSiteEvent } = useTrackSiteEvent();

  const activePersona = personaContentData[activeTab];

  return (
    <Box
      component="section"
      id="personas"
      sx={{ py: { xs: 8, md: 14 }, bgcolor: 'background.paper' }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 6 }}>
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
              {t('home.personas.title', 'Built for every role')}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 500, mx: 'auto' }}>
              {t('home.personas.subtitle', 'Whether you shop, sell, or deliver — Rendasua has you covered.')}
            </Typography>
          </motion.div>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 6 }}>
          <Tabs
            value={activeTab}
            onChange={(_, v) => {
              setActiveTab(v);
              void trackSiteEvent({ eventType: SITE_EVENT_INVENTORY_BROWSE_MORE_CLICK, metadata: { action: 'persona_tab_switch', persona: personaContentData[v]?.id, page: 'home' } });
            }}
            aria-label={t('home.personas.tabsLabel', 'Persona tabs')}
            sx={{
              bgcolor: alpha('#1e40af', 0.05),
              borderRadius: 3,
              p: 0.5,
              '& .MuiTabs-indicator': { display: 'none' },
              '& .MuiTab-root': {
                borderRadius: 2.5,
                fontWeight: 600,
                textTransform: 'none',
                minWidth: 110,
                transition: 'all 0.2s ease',
                color: 'text.secondary',
              },
              '& .Mui-selected': {
                bgcolor: 'background.paper',
                color: `${activePersona.accentColor} !important`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              },
            }}
          >
            {personaContentData.map((p, i) => (
              <Tab
                key={p.id}
                label={t(p.nameKey, p.defaultName)}
                id={`persona-tab-${i}`}
                aria-controls={`persona-panel-${i}`}
              />
            ))}
          </Tabs>
        </Box>

        {/* Persona content */}
        <Box id={`persona-${activePersona.id}`}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: shouldReduce ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Grid container spacing={5} alignItems="center">
              {/* Illustration */}
              <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                <PersonaIllustration id={activePersona.id} color={activePersona.accentColor} />
              </Grid>

              {/* Content */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Typography
                  variant="overline"
                  sx={{ color: activePersona.accentColor, fontWeight: 700, letterSpacing: '0.1em', mb: 1, display: 'block' }}
                >
                  {t(activePersona.nameKey, activePersona.defaultName)}
                </Typography>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: { xs: '1.75rem', md: '2.25rem' },
                    fontWeight: 800,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    color: 'text.primary',
                    mb: 2,
                  }}
                >
                  {t(activePersona.taglineKey, activePersona.defaultTagline)}
                </Typography>
                <Typography variant="body1" sx={{ color: 'text.secondary', mb: 3, lineHeight: 1.7 }}>
                  {t(activePersona.descriptionKey, activePersona.defaultDescription)}
                </Typography>

                {/* Features */}
                <Grid container spacing={1} sx={{ mb: 4 }}>
                  {activePersona.features.map((f) => (
                    <Grid key={f.key} size={{ xs: 12, sm: 6 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CheckCircle sx={{ fontSize: 18, color: activePersona.accentColor, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {t(f.key, f.defaultLabel)}
                        </Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>

                {/* CTAs */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap">
                  {activePersona.id !== 'business' ? (
                    <Box>
                      <AppStoreBadges variant="default" sourceSection={`persona_${activePersona.id}`} />
                    </Box>
                  ) : (
                    <Button
                      component={RouterLink}
                      to={activePersona.primaryCtaPath ?? '/signup'}
                      variant="contained"
                      endIcon={<ArrowForward />}
                      sx={{
                        bgcolor: activePersona.accentColor,
                        fontWeight: 700,
                        px: 3,
                        '&:hover': { bgcolor: activePersona.accentColor, filter: 'brightness(0.9)' },
                      }}
                    >
                      {t(activePersona.primaryCtaKey, activePersona.defaultPrimaryCta)}
                    </Button>
                  )}
                  {activePersona.secondaryCtaPath && (
                    <Button
                      component={RouterLink}
                      to={activePersona.secondaryCtaPath}
                      variant="outlined"
                      sx={{ borderColor: activePersona.accentColor, color: activePersona.accentColor, fontWeight: 600, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
                    >
                      {t(activePersona.secondaryCtaKey ?? '', activePersona.defaultSecondaryCta ?? 'Learn more')}
                    </Button>
                  )}
                </Stack>
              </Grid>
            </Grid>
          </motion.div>
        </Box>
      </Container>
    </Box>
  );
};

export default PersonaSection;
