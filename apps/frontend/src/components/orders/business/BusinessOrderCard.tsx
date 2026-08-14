import { ArrowForward, Person } from '@mui/icons-material';
import {
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { OrderData } from '../../../hooks/useOrderById';
import { buildBusinessOrderViewModel } from '../model/buildBusinessOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import { Countdown, StatusBadge } from '../shared';
import BusinessOrderActions from './BusinessOrderActions';

export interface BusinessOrderCardProps {
  order: OrderData | Record<string, unknown>;
  onActionComplete?: () => void;
  /** Defaults to `/orders` — use `/delegate/orders` in delegation shell */
  detailBasePath?: string;
}

export const BusinessOrderCard: React.FC<BusinessOrderCardProps> = ({
  order,
  onActionComplete,
  detailBasePath = '/orders',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildBusinessOrderViewModel(order as never, ctx),
    [order, ctx]
  );

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 4,
        borderColor: 'warning.main',
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="subtitle1" fontWeight={800}>
              #{vm.orderNumber}
            </Typography>
            <StatusBadge status={vm.status} label={vm.statusMessage} />
          </Stack>

          <Typography variant="h6" fontWeight={800} color="warning.dark">
            {vm.requiredAction}
          </Typography>

          {vm.slaCountdown?.deadlineAt ? (
            <Countdown
              deadlineAt={vm.slaCountdown.deadlineAt}
              label={vm.slaCountdown.label}
              compact
            />
          ) : null}

          <Stack direction="row" spacing={1} alignItems="center">
            <Person fontSize="small" color="action" />
            <Typography variant="body2" fontWeight={600}>
              {vm.customer?.name ??
                t('orders.business.unknownCustomer', 'Customer')}
            </Typography>
          </Stack>

          {vm.deliveryWindowLabel ? (
            <Typography variant="body2" color="text.secondary">
              {vm.deliveryWindowLabel}
            </Typography>
          ) : null}

          <Typography variant="caption" color="text.secondary">
            {vm.items.length}{' '}
            {t('orders.orderCard.items', 'Items')}
            {vm.paymentStatusLabel
              ? ` · ${vm.paymentStatusLabel}`
              : ''}
          </Typography>

          <Stack spacing={1}>
            <BusinessOrderActions
              order={order as OrderData}
              onActionComplete={onActionComplete}
              onShowNotification={(message, severity) =>
                enqueueSnackbar(message, { variant: severity })
              }
            />
            <Button
              size="small"
              endIcon={<ArrowForward />}
              onClick={() => navigate(`${detailBasePath}/${vm.orderId}`)}
            >
              {t('orders.viewDetails', 'View details')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default BusinessOrderCard;
