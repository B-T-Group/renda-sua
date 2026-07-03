import { Box, Container, Stack, Typography, alpha } from '@mui/material';
import { motion, useReducedMotion } from 'framer-motion';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface StoryBeat {
  stepKey: string;
  defaultStep: string;
  emojiIcon: string;
  titleKey: string;
  defaultTitle: string;
  descKey: string;
  defaultDesc: string;
  color: string;
}

const storyBeats: StoryBeat[] = [
  { stepKey: 'home.story.step1', defaultStep: '1', emojiIcon: '🔍', titleKey: 'home.story.discover.title', defaultTitle: 'Discover', descKey: 'home.story.discover.desc', defaultDesc: 'Browse products from local businesses in your city.', color: '#6366f1' },
  { stepKey: 'home.story.step2', defaultStep: '2', emojiIcon: '🛍️', titleKey: 'home.story.browse.title', defaultTitle: 'Browse', descKey: 'home.story.browse.desc', defaultDesc: 'Filter by category, brand, or distance. Find exactly what you need.', color: '#1e40af' },
  { stepKey: 'home.story.step3', defaultStep: '3', emojiIcon: '📲', titleKey: 'home.story.order.title', defaultTitle: 'Order', descKey: 'home.story.order.desc', defaultDesc: 'Place your order in seconds. Pay securely with mobile money or card.', color: '#0891b2' },
  { stepKey: 'home.story.step4', defaultStep: '4', emojiIcon: '🏪', titleKey: 'home.story.businessReceives.title', defaultTitle: 'Business prepares', descKey: 'home.story.businessReceives.desc', defaultDesc: 'The business receives your order and starts preparing it right away.', color: '#16a34a' },
  { stepKey: 'home.story.step5', defaultStep: '5', emojiIcon: '🛵', titleKey: 'home.story.agentAccepts.title', defaultTitle: 'Agent picks up', descKey: 'home.story.agentAccepts.desc', defaultDesc: 'A nearby delivery agent accepts the request and picks up your order.', color: '#f59e0b' },
  { stepKey: 'home.story.step6', defaultStep: '6', emojiIcon: '📍', titleKey: 'home.story.tracking.title', defaultTitle: 'Track live', descKey: 'home.story.tracking.desc', defaultDesc: 'Watch your delivery move on the map in real time. ETA always visible.', color: '#ef4444' },
  { stepKey: 'home.story.step7', defaultStep: '7', emojiIcon: '💬', titleKey: 'home.story.messaging.title', defaultTitle: 'Message instantly', descKey: 'home.story.messaging.desc', defaultDesc: 'Chat directly with the business or your agent at any point.', color: '#8b5cf6' },
  { stepKey: 'home.story.step8', defaultStep: '8', emojiIcon: '🔐', titleKey: 'home.story.pin.title', defaultTitle: 'Secure PIN delivery', descKey: 'home.story.pin.desc', defaultDesc: 'Share a 4-digit PIN with the agent to confirm safe delivery — no PIN, no handover.', color: '#1e40af' },
  { stepKey: 'home.story.step9', defaultStep: '9', emojiIcon: '🎉', titleKey: 'home.story.success.title', defaultTitle: 'Everybody wins', descKey: 'home.story.success.desc', defaultDesc: 'You get your order. The business grows. The agent earns. Rendasua wins together.', color: '#16a34a' },
];

const HowItWorksStorySection: React.FC = () => {
  const { t } = useTranslation();
  const shouldReduce = useReducedMotion();

  return (
    <Box
      component="section"
      id="how-it-works"
      sx={{ py: { xs: 8, md: 14 }, bgcolor: alpha('#1e40af', 0.02) }}
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
              variant="overline"
              sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: '0.12em', mb: 2, display: 'block' }}
            >
              {t('home.story.eyebrow', 'The full experience')}
            </Typography>
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
              {t('home.story.title', 'From tap to doorstep.')}
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', fontSize: { xs: '1rem', md: '1.1rem' } }}
            >
              {t('home.story.subtitle', 'Every order tells a complete story — across shopper, business, and agent.')}
            </Typography>
          </motion.div>
        </Box>

        {/* Timeline */}
        <Box sx={{ position: 'relative' }}>
          {/* Vertical connector line (desktop) */}
          <Box
            sx={{
              display: { xs: 'none', md: 'block' },
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: 2,
              bgcolor: 'divider',
              transform: 'translateX(-50%)',
              zIndex: 0,
            }}
            aria-hidden="true"
          />

          <Stack spacing={0}>
            {storyBeats.map((beat, i) => {
              const isLeft = i % 2 === 0;
              return (
                <motion.div
                  key={beat.stepKey}
                  initial={{ opacity: 0, x: shouldReduce ? 0 : (isLeft ? -24 : 24) }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ duration: 0.5, delay: 0.05 }}
                >
                  {/* Mobile: stacked */}
                  <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 2, py: 2.5, alignItems: 'flex-start' }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        bgcolor: alpha(beat.color, 0.12),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        flexShrink: 0,
                        border: `2px solid ${alpha(beat.color, 0.3)}`,
                      }}
                      aria-hidden="true"
                    >
                      {beat.emojiIcon}
                    </Box>
                    <Box sx={{ pt: 0.5 }}>
                      <Typography variant="caption" sx={{ color: beat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        {t('home.story.stepLabel', 'Step {{n}}', { n: i + 1 })}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5, lineHeight: 1.3 }}>{t(beat.titleKey, beat.defaultTitle)}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(beat.descKey, beat.defaultDesc)}</Typography>
                    </Box>
                  </Box>

                  {/* Desktop: alternating left/right */}
                  <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1fr 80px 1fr', gap: 0, alignItems: 'center', py: 2 }}>
                    {isLeft ? (
                      <>
                        {/* Left content */}
                        <Box sx={{ pr: 4, textAlign: 'right' }}>
                          <Typography variant="caption" sx={{ color: beat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {t('home.story.stepLabel', 'Step {{n}}', { n: i + 1 })}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{t(beat.titleKey, beat.defaultTitle)}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(beat.descKey, beat.defaultDesc)}</Typography>
                        </Box>
                        {/* Center circle */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: '50%',
                              border: `3px solid ${beat.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                              bgcolor: 'background.paper',
                            }}
                            aria-hidden="true"
                          >
                            {beat.emojiIcon}
                          </Box>
                        </Box>
                        {/* Right empty */}
                        <Box />
                      </>
                    ) : (
                      <>
                        {/* Left empty */}
                        <Box />
                        {/* Center circle */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                          <Box
                            sx={{
                              width: 56,
                              height: 56,
                              borderRadius: '50%',
                              border: `3px solid ${beat.color}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.5rem',
                              bgcolor: 'background.paper',
                            }}
                            aria-hidden="true"
                          >
                            {beat.emojiIcon}
                          </Box>
                        </Box>
                        {/* Right content */}
                        <Box sx={{ pl: 4 }}>
                          <Typography variant="caption" sx={{ color: beat.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                            {t('home.story.stepLabel', 'Step {{n}}', { n: i + 1 })}
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>{t(beat.titleKey, beat.defaultTitle)}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>{t(beat.descKey, beat.defaultDesc)}</Typography>
                        </Box>
                      </>
                    )}
                  </Box>
                </motion.div>
              );
            })}
          </Stack>
        </Box>
      </Container>
    </Box>
  );
};

export default HowItWorksStorySection;
