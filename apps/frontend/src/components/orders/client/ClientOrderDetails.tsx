import { Box, Grid, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderData } from '../../../hooks/useOrderById';
import { buildClientOrderViewModel } from '../model/buildClientOrderViewModel';
import { useOrderViewModelContext } from '../model/useOrderViewModelContext';
import {
  ContactCard,
  HeroActionCard,
  MoneyDisplay,
  OrderHeader,
  ProductList,
  ProgressIndicator,
  Timeline,
} from '../shared';
import ClientOrderActions from './ClientOrderActions';

export interface ClientOrderDetailsProps {
  order: OrderData;
  live?: boolean;
  onRefresh?: () => void;
  alerts?: React.ReactNode;
  messages?: React.ReactNode;
  tracking?: React.ReactNode;
  extras?: React.ReactNode;
  headerTrailing?: React.ReactNode;
  hideDeliveryPin?: boolean;
  hideActions?: boolean;
  onActionComplete?: () => void;
  onShowNotification?: (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info'
  ) => void;
}

export const ClientOrderDetails: React.FC<ClientOrderDetailsProps> = ({
  order,
  live,
  onRefresh,
  alerts,
  messages,
  tracking,
  extras,
  headerTrailing,
  hideDeliveryPin = false,
  hideActions = false,
  onActionComplete,
  onShowNotification,
}) => {
  const { t } = useTranslation();
  const ctx = useOrderViewModelContext();
  const vm = useMemo(
    () => buildClientOrderViewModel(order, ctx),
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
        subtitle={vm.businessName}
        trailing={headerTrailing}
      />

      <HeroActionCard
        title={vm.heroTitle}
        subtitle={vm.nextStepMessage}
        accent="primary"
      >
        {vm.etaText ? (
          <Typography variant="h6" color="primary.main" fontWeight={700}>
            {vm.etaText}
          </Typography>
        ) : null}
        {!hideActions ? (
          <ClientOrderActions
            order={order}
            onActionComplete={onActionComplete}
            onShowNotification={onShowNotification}
            hideDeliveryPin={hideDeliveryPin}
          />
        ) : null}
      </HeroActionCard>

      {alerts}

      <ProgressIndicator
        status={vm.status}
        fulfillmentMethod={order.fulfillment_method}
        activeStep={vm.progress.activeStep}
      />

      {messages}
      {tracking}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ContactCard
            title={t('orders.client.actions.contactBusiness', 'Contact business')}
            contact={vm.contacts.business}
          />
        </Grid>
        {vm.contacts.agent ? (
          <Grid size={{ xs: 12, md: 6 }}>
            <ContactCard
              title={t(
                'orders.client.actions.contactAgent',
                'Contact delivery agent'
              )}
              contact={vm.contacts.agent}
            />
          </Grid>
        ) : null}
      </Grid>

      <Stack spacing={2}>
        <Timeline entries={vm.timeline} />
        <ProductList items={vm.items} />
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
        {extras}
      </Stack>
    </Box>
  );
};

export default ClientOrderDetails;
