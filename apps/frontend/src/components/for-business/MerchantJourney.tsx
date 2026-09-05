import {
  AccountCircle,
  AutoAwesome,
  LocalShipping,
  Payments,
  ShoppingBag,
  Storefront,
  Upload,
} from '@mui/icons-material';
import { Box, Typography, alpha } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import SectionShell from './SectionShell';
import { FB_ACCENT } from './forBusinessTheme';

const MerchantJourney: React.FC = () => {
  const { t } = useTranslation();
  const steps = [
    { icon: <AccountCircle />, key: 'account', def: 'Create account' },
    { icon: <Upload />, key: 'products', def: 'Add products' },
    { icon: <AutoAwesome />, key: 'ai', def: 'AI improves listings' },
    { icon: <Storefront />, key: 'live', def: 'Products go live' },
    { icon: <ShoppingBag />, key: 'orders', def: 'Customers order' },
    { icon: <LocalShipping />, key: 'pickup', def: 'Agent picks up' },
    { icon: <Payments />, key: 'paid', def: 'You get paid' },
  ];

  return (
    <SectionShell
      title={t('forBusiness.journey.title', 'From signup to payout')}
      subtitle={t(
        'forBusiness.journey.subtitle',
        'A clear path from your first listing to money in your account.'
      )}
      bgcolor="background.paper"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: 'stretch',
          position: 'relative',
        }}
      >
        {steps.map((s, i) => (
          <Box
            key={s.key}
            sx={{
              flex: 1,
              textAlign: 'center',
              p: 2,
              borderRadius: 3,
              bgcolor: alpha(FB_ACCENT, 0.04),
              border: '1px solid',
              borderColor: alpha(FB_ACCENT, 0.15),
              position: 'relative',
            }}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                bgcolor: FB_ACCENT,
                color: '#fff',
                fontWeight: 800,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ color: FB_ACCENT, mb: 1 }} aria-hidden>
              {s.icon}
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {t(`forBusiness.journey.steps.${s.key}`, s.def)}
            </Typography>
          </Box>
        ))}
      </Box>
    </SectionShell>
  );
};

export default MerchantJourney;
