import {
  AutoAwesome,
  PhotoCamera,
  Publish,
  Search,
  Tune,
} from '@mui/icons-material';
import { Box, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionCTA from './SectionCTA';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const AIWorkflow: React.FC = () => {
  const { t } = useTranslation();
  const steps = [
    { icon: <PhotoCamera />, key: 'upload', def: 'Upload photo' },
    { icon: <Tune />, key: 'clean', def: 'AI cleans image' },
    { icon: <AutoAwesome />, key: 'describe', def: 'AI writes description' },
    { icon: <Publish />, key: 'publish', def: 'Product published' },
    { icon: <Search />, key: 'discover', def: 'Customers find it' },
  ];

  return (
    <SectionShell
      title={t('forBusiness.ai.title', 'AI that turns a photo into a listing')}
      subtitle={t(
        'forBusiness.ai.subtitle',
        'Skip hours of writing. Upload a product photo and go live faster.'
      )}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { xs: 'stretch', md: 'center' },
          gap: { xs: 2, md: 1 },
          justifyContent: 'center',
        }}
      >
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <Box
              sx={{
                flex: 1,
                maxWidth: { md: 160 },
                textAlign: 'center',
                p: 2,
                borderRadius: 3,
                border: '1.5px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  mx: 'auto',
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(FB_ACCENT, 0.1),
                  color: FB_ACCENT,
                }}
                aria-hidden
              >
                {s.icon}
              </Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                {t(`forBusiness.ai.steps.${s.key}`, s.def)}
              </Typography>
            </Box>
            {i < steps.length - 1 ? (
              <Typography
                aria-hidden
                sx={{
                  display: { xs: 'none', md: 'block' },
                  color: FB_ACCENT,
                  fontWeight: 800,
                  px: 0.5,
                }}
              >
                →
              </Typography>
            ) : null}
          </React.Fragment>
        ))}
      </Box>
      <SectionCTA
        primaryLabel={t('forBusiness.cta.startToday', 'Start selling today')}
      />
    </SectionShell>
  );
};

export default AIWorkflow;
