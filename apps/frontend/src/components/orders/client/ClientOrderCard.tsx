import { ArrowForward } from '@mui/icons-material';
import {
  Box,
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
import OrderRatingCtas from '../../common/OrderRatingCtas';
import { buildClientOrderViewModel } from '../model/buildClientOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import {
  MoneyDisplay,
  StatusBadge,
} from '../shared';
import ClientOrderActions from './ClientOrderActions';

export interface ClientOrderCardProps {
  order: OrderData | Record<string, unknown>;
  onActionComplete?: () => void;
}

export const ClientOrderCard: React.FC<ClientOrderCardProps> = ({
  order,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildClientOrderViewModel(order as never, ctx),
    [order, ctx]
  );

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 4,
        borderColor: 'primary.main',
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

          <Typography variant="body1" fontWeight={700}>
            {vm.heroTitle}
          </Typography>

          {vm.etaText ? (
            <Typography variant="body2" color="primary.main" fontWeight={600}>
              {vm.etaText}
            </Typography>
          ) : null}

          {vm.nextStepMessage ? (
            <Typography variant="body2" color="text.secondary">
              {t('orders.client.nextStep', 'What happens next')}:{' '}
              {vm.nextStepMessage}
            </Typography>
          ) : null}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary" noWrap>
              {vm.businessName}
            </Typography>
            <MoneyDisplay
              amount={vm.summary.total}
              currency={vm.summary.currency}
              variant="body1"
            />
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('orders.progress', 'Progress')}: {vm.progress.activeStep + 1}/
              {vm.progress.totalSteps}
            </Typography>
          </Box>

          <OrderRatingCtas orderId={vm.orderId} orderStatus={vm.status} />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <ClientOrderActions
              order={order as OrderData}
              onActionComplete={onActionComplete}
              deliveryPinFullWidth
              onShowNotification={(message, severity) =>
                enqueueSnackbar(message, { variant: severity })
              }
            />
            <Button
              size="small"
              endIcon={<ArrowForward />}
              onClick={() => navigate(`/orders/${vm.orderId}`)}
            >
              {t('orders.viewDetails', 'View details')}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ClientOrderCard;
