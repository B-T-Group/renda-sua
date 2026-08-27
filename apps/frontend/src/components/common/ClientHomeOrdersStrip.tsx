import {
  LocalShipping,
  Payment,
  Pin,
  ShoppingBag,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Order } from '../../hooks/useOrders';
import {
  ORDER_PRIMARY_ACTION_LABEL,
  orderToPhaseInput,
  resolveOrderPhase,
  type OrderPrimaryActionId,
} from '../../utils/orderPhase';

const TRACK_STATUSES = new Set(['picked_up', 'in_transit', 'out_for_delivery']);

function ctaFor(order: Order, action: OrderPrimaryActionId): {
  key: string;
  defaultValue: string;
  icon: React.ReactElement;
} {
  if (action !== 'none' && ORDER_PRIMARY_ACTION_LABEL[action]?.[1]) {
    const [key, defaultValue] = ORDER_PRIMARY_ACTION_LABEL[action];
    const icon =
      action === 'pay' ? (
        <Payment />
      ) : action === 'send_pin' ? (
        <Pin />
      ) : (
        <ShoppingBag />
      );
    return { key, defaultValue, icon };
  }
  if (TRACK_STATUSES.has(order.current_status || '')) {
    return {
      key: 'client.home.liveOrders.ctaTrack',
      defaultValue: 'Track order',
      icon: <LocalShipping />,
    };
  }
  return {
    key: 'client.home.liveOrders.ctaView',
    defaultValue: 'View order',
    icon: <ShoppingBag />,
  };
}

export interface ClientHomeOrdersStripProps {
  orders: Order[];
  totalActive: number;
  onTrackOrder?: (order: Order) => void;
}

const ClientHomeOrdersStrip: React.FC<ClientHomeOrdersStripProps> = ({
  orders,
  totalActive,
  onTrackOrder,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (orders.length === 0) return null;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
          {t('client.home.liveOrders.title', 'In progress')}
        </Typography>
        <Chip size="small" color="primary" label={totalActive} />
      </Stack>
      <Stack spacing={1.25}>
        {orders.map((order) => {
          const phase = resolveOrderPhase(orderToPhaseInput(order), 'client');
          const cta = ctaFor(order, phase.primaryActionId);
          const title = t(phase.labelKey, phase.phase);
          const subtitle = phase.nextStepKey
            ? t(phase.nextStepKey, '')
            : t('client.home.liveOrders.openDetail', 'Open the order for details.');
          const isTrack =
            phase.primaryActionId === 'none' &&
            TRACK_STATUSES.has(order.current_status || '');

          return (
            <Card
              key={order.id}
              variant="outlined"
              sx={{
                borderRadius: 2,
                bgcolor: (theme) =>
                  alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.06),
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.35),
              }}
            >
              <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    #{order.order_number}
                  </Typography>
                  <Chip size="small" label={title} color="primary" variant="outlined" />
                </Stack>
                {subtitle ? (
                  <Typography variant="body2" color="text.secondary">
                    {subtitle}
                  </Typography>
                ) : null}
              </CardContent>
              <CardActions sx={{ px: 2, pb: 1.5, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={cta.icon}
                  onClick={() => {
                    if (isTrack && onTrackOrder) {
                      onTrackOrder(order);
                      return;
                    }
                    navigate(`/orders/${order.id}`);
                  }}
                  sx={{ fontWeight: 800 }}
                >
                  {t(cta.key, cta.defaultValue)}
                </Button>
              </CardActions>
            </Card>
          );
        })}
      </Stack>
      {totalActive > orders.length ? (
        <Button
          sx={{ mt: 1, fontWeight: 700 }}
          onClick={() => navigate('/orders')}
        >
          {t('client.home.liveOrders.seeAll', 'View all {{count}} orders', {
            count: totalActive,
          })}
        </Button>
      ) : null}
    </Box>
  );
};

export default ClientHomeOrdersStrip;
