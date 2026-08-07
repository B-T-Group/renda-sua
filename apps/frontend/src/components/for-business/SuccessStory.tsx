import { CheckCircle, Close } from '@mui/icons-material';
import { Box, Grid, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_GREEN } from './forBusinessTheme';

const SuccessStory: React.FC = () => {
  const { t } = useTranslation();
  const before = [
    t('forBusiness.success.before.item1', 'Orders only through WhatsApp'),
    t('forBusiness.success.before.item2', 'Manual inventory in notebooks'),
    t('forBusiness.success.before.item3', 'No delivery partners'),
    t('forBusiness.success.before.item4', 'No sales analytics'),
  ];
  const after = [
    t('forBusiness.success.after.item1', 'Online storefront'),
    t('forBusiness.success.after.item2', 'Integrated delivery'),
    t('forBusiness.success.after.item3', 'Secure payments'),
    t('forBusiness.success.after.item4', 'Analytics that guide decisions'),
    t('forBusiness.success.after.item5', 'More customers discovering you'),
  ];

  return (
    <SectionShell
      title={t('forBusiness.success.title', 'Before vs after Rendasua')}
      subtitle={t(
        'forBusiness.success.subtitle',
        'The same business — with tools that scale.'
      )}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              bgcolor: alpha('#ef4444', 0.04),
              border: '1.5px solid',
              borderColor: alpha('#ef4444', 0.2),
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: '#b91c1c' }}>
              {t('forBusiness.success.before.title', 'Before')}
            </Typography>
            {before.map((line) => (
              <Box key={line} sx={{ display: 'flex', gap: 1, mb: 1.25, alignItems: 'flex-start' }}>
                <Close sx={{ color: '#ef4444', fontSize: 20, mt: 0.2 }} aria-hidden />
                <Typography variant="body2">{line}</Typography>
              </Box>
            ))}
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              height: '100%',
              bgcolor: alpha(FB_GREEN, 0.06),
              border: '1.5px solid',
              borderColor: alpha(FB_GREEN, 0.25),
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: FB_GREEN }}>
              {t('forBusiness.success.after.title', 'After')}
            </Typography>
            {after.map((line) => (
              <Box key={line} sx={{ display: 'flex', gap: 1, mb: 1.25, alignItems: 'flex-start' }}>
                <CheckCircle sx={{ color: FB_GREEN, fontSize: 20, mt: 0.2 }} aria-hidden />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {line}
                </Typography>
              </Box>
            ))}
          </Box>
        </Grid>
      </Grid>
    </SectionShell>
  );
};

export default SuccessStory;
