import { Language, LocalShipping, Payments, Store } from '@mui/icons-material';
import { Box, Grid, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const LocalContext: React.FC = () => {
  const { t } = useTranslation();
  const items = [
    { icon: <LocalShipping />, key: 'delivery', title: 'Local delivery', desc: 'Agents who know your city streets.' },
    { icon: <Payments />, key: 'momo', title: 'Mobile Money', desc: 'Payouts and payments that match how you already sell.' },
    { icon: <Language />, key: 'language', title: 'French support', desc: 'Sell and manage your store in French or English.' },
    { icon: <Store />, key: 'local', title: 'Built for local commerce', desc: 'Designed for neighborhood merchants, not only big retail.' },
  ];

  return (
    <SectionShell
      title={t('forBusiness.local.title', 'Built for local businesses')}
      subtitle={t(
        'forBusiness.local.subtitle',
        'Tools that fit how commerce already works in your market.'
      )}
      bgcolor="background.paper"
    >
      <Grid container spacing={2.5}>
        {items.map((item) => (
          <Grid key={item.key} size={{ xs: 12, sm: 6 }}>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                p: 2.5,
                borderRadius: 3,
                border: '1.5px solid',
                borderColor: 'divider',
                height: '100%',
              }}
            >
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(FB_ACCENT, 0.1),
                  color: FB_ACCENT,
                }}
                aria-hidden
              >
                {item.icon}
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {t(`forBusiness.local.${item.key}.title`, item.title)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {t(`forBusiness.local.${item.key}.desc`, item.desc)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        ))}
      </Grid>
    </SectionShell>
  );
};

export default LocalContext;
