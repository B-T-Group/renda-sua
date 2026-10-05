import { Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { foodServiceStyle } from '../../utils/cookedFoodOrder';
import { EatInIllustration } from './EatInIllustration';
import { TakeOutIllustration } from './TakeOutIllustration';

export function FoodServiceStyleLabel({
  order,
}: {
  order: { is_cooked_food_pickup?: boolean | null; eat_in?: boolean | null };
}) {
  const { t } = useTranslation();
  const style = foodServiceStyle(order);
  if (!style) return null;
  const eatIn = style === 'eat_in';
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {eatIn ? <EatInIllustration size={40} /> : <TakeOutIllustration size={40} />}
      <Typography variant="subtitle2" fontWeight={700}>
        {eatIn
          ? t('orders.eatIn.eatIn', 'Eat in')
          : t('orders.eatIn.takeOut', 'Take out')}
      </Typography>
    </Stack>
  );
}
