import {
  GppGood,
  Headphones,
  LocalShipping,
  Lock,
  VerifiedUser,
} from '@mui/icons-material';
import { Box, Grid, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_GREEN } from './forBusinessTheme';

const SecuritySection: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    { icon: <Lock />, key: 'payments', title: 'Secure payments', desc: 'Protected checkout for you and your customers.' },
    { icon: <GppGood />, key: 'data', title: 'Protected customer data', desc: 'Privacy-minded handling of shopper information.' },
    { icon: <LocalShipping />, key: 'delivery', title: 'Reliable deliveries', desc: 'PIN-verified handovers with delivery agents.' },
    { icon: <Headphones />, key: 'support', title: 'Merchant support', desc: 'Help when you need to grow or resolve issues.' },
    { icon: <VerifiedUser />, key: 'verified', title: 'Verified platform', desc: 'A professional marketplace customers already trust.' },
  ];

  return (
    <SectionShell
      title={t('forBusiness.security.title', 'Security & trust')}
      subtitle={t(
        'forBusiness.security.subtitle',
        'Confidence for you — and for every customer who buys.'
      )}
      bgcolor="background.paper"
    >
      <Grid container spacing={2}>
        {items.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ display: 'flex', gap: 1.5, p: 1.5 }}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  bgcolor: alpha(FB_GREEN, 0.1),
                  color: FB_GREEN,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
                aria-hidden
              >
                {item.icon}
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t(`forBusiness.security.${item.key}.title`, item.title)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(`forBusiness.security.${item.key}.desc`, item.desc)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </SectionShell>
  );
};

export default SecuritySection;
