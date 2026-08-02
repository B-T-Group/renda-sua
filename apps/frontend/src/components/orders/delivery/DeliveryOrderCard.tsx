import { ArrowForward, LocalShipping, Payments } from '@mui/icons-material';
import {
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAccountInfo } from '../../../hooks';
import { useApiClient } from '../../../hooks/useApiClient';
import type { OrderData } from '../../../hooks/useOrderById';
import { buildDeliveryOrderViewModel } from '../model/buildDeliveryOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import { Countdown, MoneyDisplay, StatusBadge } from '../shared';
import DeliveryOrderActions from './DeliveryOrderActions';

export interface DeliveryOrderCardProps {
  order: OrderData | Record<string, unknown>;
  onActionComplete?: () => void;
}

export const DeliveryOrderCard: React.FC<DeliveryOrderCardProps> = ({
  order,
  onActionComplete,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const { accounts } = useAccountInfo();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildDeliveryOrderViewModel(order as never, ctx),
    [order, ctx]
  );
  const [cancellingClaim, setCancellingClaim] = useState(false);
  const claimPending = Boolean(
    (order as { is_claim_pending?: boolean }).is_claim_pending
  );

  const handleCancelClaimRequest = async () => {
    if (!apiClient) {
      enqueueSnackbar(
        t('messages.apiClientUnavailable', 'API client not available'),
        { variant: 'error' }
      );
      return;
    }
    setCancellingClaim(true);
    try {
      const response = await apiClient.post('/orders/cancel-claim-request', {
        orderId: vm.orderId,
      });
      if (!response.data?.success) {
        throw new Error(
          response.data?.error ||
            response.data?.message ||
            t(
              'orders.claimPending.cancelRequestFailed',
              'Failed to cancel claim request'
            )
        );
      }
      enqueueSnackbar(
        t(
          'orders.claimPending.cancelRequestSuccess',
          'Claim request cancelled successfully'
        ),
        { variant: 'success' }
      );
      onActionComplete?.();
    } catch (error: any) {
      enqueueSnackbar(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          t(
            'orders.claimPending.cancelRequestFailed',
            'Failed to cancel claim request'
          ),
        { variant: 'error' }
      );
    } finally {
      setCancellingClaim(false);
    }
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: 4,
        borderColor: 'secondary.main',
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

          <Typography variant="h6" fontWeight={800}>
            {vm.currentObjective}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center">
            <Payments color="success" fontSize="small" />
            <MoneyDisplay
              amount={vm.earnings.estimatedTotal ?? vm.earnings.commission}
              currency={vm.earnings.currency}
              variant="h6"
              color="success.main"
            />
            {vm.distanceLabel ? (
              <Chip size="small" label={vm.distanceLabel} />
            ) : null}
          </Stack>

          {vm.urgency?.deadlineAt ? (
            <Countdown
              deadlineAt={vm.urgency.deadlineAt}
              label={vm.urgency.label}
              compact
            />
          ) : null}

          {vm.deliveryWindowLabel ? (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <LocalShipping fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {vm.deliveryWindowLabel}
              </Typography>
            </Stack>
          ) : null}

          <Typography variant="caption" color="text.secondary">
            {vm.packageInfo.itemCount}{' '}
            {t('orders.orderCard.items', 'Items')}
            {vm.packageInfo.weightLabel
              ? ` · ${vm.packageInfo.weightLabel}`
              : ''}
          </Typography>

          <Stack spacing={1}>
            {claimPending ? (
              <Button
                variant="outlined"
                color="error"
                disabled={cancellingClaim}
                onClick={() => void handleCancelClaimRequest()}
                startIcon={
                  cancellingClaim ? <CircularProgress size={16} /> : undefined
                }
              >
                {t(
                  'orders.claimPending.cancelRequest',
                  'Cancel claim request'
                )}
              </Button>
            ) : (
              <DeliveryOrderActions
                order={order as OrderData}
                agentAccounts={accounts}
                onActionComplete={onActionComplete}
                mobileView
                onShowNotification={(message, severity) =>
                  enqueueSnackbar(message, { variant: severity })
                }
              />
            )}
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

export default DeliveryOrderCard;
