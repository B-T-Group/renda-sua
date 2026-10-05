import { Alert, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { showEatInUnavailableNotice } from '../../utils/cookedFoodOrder';
import { TakeOutIllustration } from './TakeOutIllustration';

export function EatInUnavailableNotice({
  order,
}: {
  order: {
    eat_in?: boolean | null;
    eat_in_unavailable?: boolean | null;
    payment_status?: string | null;
  };
}) {
  const { t } = useTranslation();
  if (!showEatInUnavailableNotice(order)) return null;
  return (
    <Alert severity="warning" icon={false}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TakeOutIllustration size={64} />
        <Typography variant="body2">
          {t(
            'orders.eatIn.noTableClient',
            'There is no table. Approve the payment request to take this order out, or cancel it.'
          )}
        </Typography>
      </Stack>
    </Alert>
  );
}
