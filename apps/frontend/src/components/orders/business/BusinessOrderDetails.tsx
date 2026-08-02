import { Alert, Box, Grid, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../../hooks/useOrderById';
import { buildBusinessOrderViewModel } from '../model/buildBusinessOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import {
  ContactCard,
  DeliveryWindowCard,
  HeroActionCard,
  MoneyDisplay,
  OrderHeader,
  ProductList,
} from '../shared';
import BusinessOrderActions from './BusinessOrderActions';

export interface BusinessOrderDetailsProps {
  order: OrderData;
  live?: boolean;
  onRefresh?: () => void;
  alerts?: React.ReactNode;
  messages?: React.ReactNode;
  extras?: React.ReactNode;
  hideActions?: boolean;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const BusinessOrderDetails: React.FC<BusinessOrderDetailsProps> = ({
  order,
  live,
  onRefresh,
  alerts,
  messages,
  extras,
  hideActions = false,
  onActionComplete,
  onShowNotification,
}) => {
  const { t } = useTranslation();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildBusinessOrderViewModel(order, ctx),
    [order, ctx]
  );

  return (
    <Box>
      <OrderHeader
        orderNumber={vm.orderNumber}
        status={vm.status}
        statusLabel={vm.statusMessage}
        live={live}
        onRefresh={onRefresh}
      />

      <HeroActionCard
        title={vm.requiredAction}
        subtitle={vm.nextStepMessage}
        deadlineAt={vm.slaCountdown?.deadlineAt}
        deadlineLabel={vm.slaCountdown?.label}
        accent="warning"
      >
        {!hideActions ? (
          <BusinessOrderActions
            order={order}
            onActionComplete={onActionComplete}
            onShowNotification={onShowNotification}
          />
        ) : null}
      </HeroActionCard>

      {alerts}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ContactCard
            title={t('orders.business.actions.contactCustomer', 'Contact customer')}
            contact={vm.customer}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ContactCard
            title={t('orders.business.actions.contactAgent', 'Contact agent')}
            contact={vm.assignedAgent}
            emptyLabel={t(
              'orders.business.noAgentAssigned',
              'No agent assigned yet'
            )}
          />
        </Grid>
      </Grid>

      {vm.notes ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            {t('orders.notes', 'Notes')}
          </Typography>
          {vm.notes}
        </Alert>
      ) : null}

      <Stack spacing={2}>
        <ProductList items={vm.items} />
        <DeliveryWindowCard order={order} />
        {vm.paymentStatusLabel ? (
          <Typography variant="body2">
            {t('orders.paymentStatus', 'Payment')}: {vm.paymentStatusLabel}
          </Typography>
        ) : null}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            {t('orders.total', 'Total')}:
          </Typography>
          <MoneyDisplay
            amount={vm.summary.total}
            currency={vm.summary.currency}
            variant="h6"
          />
        </Box>
        {messages}
        {extras}
      </Stack>
    </Box>
  );
};

export default BusinessOrderDetails;
