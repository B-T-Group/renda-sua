import { Box, Container, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionCTA from './SectionCTA';
import { FB_ACCENT, SIGNUP_RENT } from './forBusinessTheme';

const FinalCTA: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Box
      component="section"
      sx={{ py: { xs: 8, md: 12 }, bgcolor: alpha(FB_ACCENT, 0.06) }}
    >
      <Container maxWidth="md">
        <Box sx={{ textAlign: 'center' }}>
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: '1.875rem', md: '2.5rem' },
              fontWeight: 800,
              letterSpacing: '-0.02em',
              mb: 2,
            }}
          >
            {t('forBusiness.final.title', 'Ready to grow your business?')}
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 1 }}>
            {t(
              'forBusiness.final.subtitle',
              'Join Rendasua today. Create your store for free in under 5 minutes.'
            )}
          </Typography>
          <SectionCTA
            primaryLabel={t(
              'forBusiness.cta.primary',
              'Create my store for free'
            )}
            secondaryLabel={t('forBusiness.hero.rentalCta', 'Open Rental Account')}
            secondaryTo={SIGNUP_RENT}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default FinalCTA;
