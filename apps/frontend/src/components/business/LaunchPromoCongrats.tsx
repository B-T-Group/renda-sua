import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LaunchPromoCongratsIllustration } from '../illustrations/LaunchPromoCongratsIllustration';

export interface LaunchPromoCongratsData {
  businessLimit: number | null;
  zeroCommissionOrders: number | null;
  identificationWindowDays: number | null;
}

interface LaunchPromoCongratsProps {
  promo: LaunchPromoCongratsData;
}

const LaunchPromoCongrats: React.FC<LaunchPromoCongratsProps> = ({ promo }) => {
  const { t } = useTranslation();
  const limit = promo.businessLimit ?? 150;
  const orders = promo.zeroCommissionOrders ?? 15;
  const days = promo.identificationWindowDays ?? 30;

  return (
    <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', py: 1 }}>
      <LaunchPromoCongratsIllustration
        label={t(
          'business.launchPromo.illustrationLabel',
          'Launch promo celebration'
        )}
      />
      <Typography variant="h6" component="h2">
        {t('business.launchPromo.congratsTitle', {
          defaultValue: "You're one of our first {{limit}} businesses!",
          limit,
        })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('business.launchPromo.congratsBody', {
          defaultValue:
            'As part of our launch, you get 0% commission on your first {{orders}} orders. Complete identification within {{days}} days to keep this benefit.',
          orders,
          days,
        })}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t(
          'business.launchPromo.referralNudge',
          'Tip: share your business referral code with other merchants — when they get identified and add approved items, you can earn a cash bonus on the side.'
        )}
      </Typography>
    </Stack>
  );
};

export default LaunchPromoCongrats;
