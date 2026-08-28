import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountInfo } from '../../../hooks';
import { useApiClient } from '../../../hooks/useApiClient';
import type { OrderData } from '../../../hooks/useOrderById';
import { buildDeliveryOrderViewModel } from '../model/buildDeliveryOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import {
  AddressCard,
  ContactCard,
  HeroActionCard,
  MoneyDisplay,
  OrderHeader,
  ProductList,
} from '../shared';
import DeliveryOrderActions from './DeliveryOrderActions';

export interface DeliveryOrderDetailsProps {
  order: OrderData;
  live?: boolean;
  onRefresh?: () => void;
  alerts?: React.ReactNode;
  messages?: React.ReactNode;
  tracking?: React.ReactNode;
  extras?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  hideActions?: boolean;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const DeliveryOrderDetails: React.FC<DeliveryOrderDetailsProps> = ({
  order,
  live,
  onRefresh,
  alerts,
  messages,
  tracking,
  extras,
  headerTrailing,
  hideActions = false,
  onActionComplete,
  onShowNotification,
}) => {
  const { t } = useTranslation();
  const { accounts } = useAccountInfo();
  const apiClient = useApiClient();
  const { enqueueSnackbar } = useSnackbar();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildDeliveryOrderViewModel(order, ctx),
    [order, ctx]
  );
  const [cancellingClaim, setCancellingClaim] = useState(false);
  const claimPending = Boolean(
    (order as { is_claim_pending?: boolean }).is_claim_pending
  );

  const handleCancelClaimRequest = async () => {
    if (!apiClient) {
      onShowNotification?.(
        t('messages.apiClientUnavailable', 'API client not available'),
        'error'
      );
      return;
    }
    setCancellingClaim(true);
    try {
      const response = await apiClient.post('/orders/cancel-claim-request', {
        orderId: order.id,
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
      onShowNotification?.(
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.message ||
          t(
            'orders.claimPending.cancelRequestFailed',
            'Failed to cancel claim request'
          ),
        'error'
      );
    } finally {
      setCancellingClaim(false);
    }
  };

  return (
    <Box>
      <OrderHeader
        orderNumber={vm.orderNumber}
        status={vm.status}
        statusLabel={vm.statusMessage}
        live={live}
        onRefresh={onRefresh}
        trailing={headerTrailing}
      />

      <HeroActionCard
        title={
          claimPending
            ? t('orders.claimPending.title', 'Claim payment pending')
            : vm.currentObjective
        }
        subtitle={
          claimPending
            ? t(
                'orders.claimPending.waiting',
                'Waiting for hold payment approval. You can cancel this claim request.'
              )
            : vm.nextStepMessage
        }
        deadlineAt={claimPending ? null : vm.urgency?.deadlineAt}
        deadlineLabel={vm.urgency?.label}
        accent="secondary"
      >
        {!hideActions ? (
          claimPending ? (
            <Button
              variant="outlined"
              color="error"
              disabled={cancellingClaim}
              onClick={() => void handleCancelClaimRequest()}
              startIcon={
                cancellingClaim ? <CircularProgress size={16} /> : undefined
              }
            >
              {t('orders.claimPending.cancelRequest', 'Cancel claim request')}
            </Button>
          ) : (
            <DeliveryOrderActions
              order={order}
              agentAccounts={accounts}
              onActionComplete={onActionComplete}
              onShowNotification={onShowNotification}
            />
          )
        ) : null}
      </HeroActionCard>

      {alerts}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {vm.stops.map((stop) => (
          <Grid key={stop.kind} size={{ xs: 12, md: 6 }}>
            <Stack spacing={1}>
              <AddressCard
                title={stop.title}
                address={stop.address}
                instructions={stop.instructions}
                showNavigate
              />
              <ContactCard
                title={
                  stop.kind === 'pickup'
                    ? t(
                        'orders.delivery.actions.contactBusiness',
                        'Contact Business'
                      )
                    : t(
                        'orders.delivery.actions.contactCustomer',
                        'Contact Customer'
                      )
                }
                contact={stop.contact}
              />
            </Stack>
          </Grid>
        ))}
      </Grid>

      {vm.deliveryWindowLabel ? (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700}>
              {t('orders.deliveryTimeWindow.title', 'Delivery Time Window')}
            </Typography>
            <Typography variant="body2">{vm.deliveryWindowLabel}</Typography>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('orders.delivery.packageInfo', 'Package information')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {vm.packageInfo.itemCount} items · {vm.packageInfo.packageCount}{' '}
            packages
            {vm.packageInfo.weightLabel
              ? ` · ${vm.packageInfo.weightLabel}`
              : ''}
            {vm.packageInfo.dimensionsLabel
              ? ` · ${vm.packageInfo.dimensionsLabel}`
              : ''}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
            {vm.packageInfo.properties.map((p) => (
              <Chip key={p.id} size="small" label={p.label} />
            ))}
            {vm.deliveryRequirements.map((r) => (
              <Chip key={r.id} size="small" color="warning" label={r.label} />
            ))}
          </Stack>
          <ProductList
            items={vm.packageInfo.items}
            showPrices={false}
            title={t('orders.orderCard.items', 'Items')}
          />
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            {t('orders.delivery.earnings', 'Earnings')}
          </Typography>
          <MoneyDisplay
            amount={vm.earnings.estimatedTotal ?? vm.earnings.commission}
            currency={vm.earnings.currency}
            variant="h4"
            color="success.main"
          />
        </CardContent>
      </Card>

      {tracking}
      {messages}
      {extras}
    </Box>
  );
};

export default DeliveryOrderDetails;
