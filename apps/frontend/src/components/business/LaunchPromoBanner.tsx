import { Card, CardContent, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useBusinessVerification } from '../../hooks/useBusinessVerification';

const LaunchPromoBanner: React.FC = () => {
  const { t } = useTranslation();
  const { status, loading } = useBusinessVerification();
  const promo = status?.launchPromo;

  if (loading || !promo || promo.ordersRemaining <= 0) {
    return null;
  }

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: 'success.main',
        bgcolor: (theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(46, 125, 50, 0.12)'
            : 'rgba(46, 125, 50, 0.06)',
      }}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={0.5}>
          <Typography variant="subtitle2" color="success.main" fontWeight={700}>
            {t('business.launchPromo.bannerTitle', '0% commission launch promo')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('business.launchPromo.bannerBody', {
              defaultValue:
                'You still have {{remaining}} of {{total}} orders with 0% item commission.',
              remaining: promo.ordersRemaining,
              total: promo.zeroCommissionOrders ?? promo.ordersRemaining,
            })}
          </Typography>
          {promo.status === 'claimed' ? (
            <Typography variant="caption" color="warning.main">
              {t('business.launchPromo.identifyReminder', {
                defaultValue:
                  'Complete identification within {{days}} days to keep this promo.',
                days: promo.identificationWindowDays ?? 30,
              })}
            </Typography>
          ) : null}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LaunchPromoBanner;
