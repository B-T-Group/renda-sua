import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../../hooks/useOrders';
import { isCookedFoodStartCookingPriority } from '../../../utils/cookedFoodOrder';

interface Props {
  orders: Order[];
}

export function CookedFoodStartCookingStrip({ orders }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const priority = orders.filter((o) => isCookedFoodStartCookingPriority(o));
  if (priority.length === 0) return null;

  const first = priority[0];

  return (
    <Alert
      severity="warning"
      icon={<RestaurantMenuIcon />}
      sx={{ mb: 2, borderRadius: 2 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
      >
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('orders.cookedFood.startCookingTitle', 'Start cooking')}
          </Typography>
          <Typography variant="body2">
            {priority.length === 1
              ? t(
                  'orders.cookedFood.startCookingOne',
                  'Order #{{number}} is paid and ready for your kitchen.',
                  { number: first.order_number }
                )
              : t(
                  'orders.cookedFood.startCookingMany',
                  '{{count}} cooked-food orders need your kitchen now.',
                  { count: priority.length }
                )}
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="warning"
          onClick={() => navigate(`/orders/${first.id}`)}
        >
          {t('orders.cookedFood.openOrder', 'Open order')}
        </Button>
      </Stack>
    </Alert>
  );
}
