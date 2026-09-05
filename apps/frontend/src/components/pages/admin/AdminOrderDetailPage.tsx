import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useAcknowledgeRiskIncident,
  useAdminOrderDetail,
  type AdminOrderTiming,
  type OrderContactRole,
} from '../../../hooks/useAdminOrders';
import { OrderInterventionPanel } from '../../admin/orders/OrderInterventionPanel';
import { OrderParticipantsCard } from '../../admin/orders/OrderParticipantsCard';
import { OrderRiskChip } from '../../admin/orders/OrderRiskChip';
import { OrderRiskIncidentsCard } from '../../admin/orders/OrderRiskIncidentsCard';
import type { ResolveEscalationPayload } from '../../admin/orders/ResolveEscalationDialog';
import { OrderTimelineCard } from '../../admin/orders/OrderTimelineCard';
import {
  formatOrderAmount,
  statusColor,
} from '../../admin/orders/orderRiskLabels';

export const AdminOrderDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { data, isLoading, error, refetch } = useAdminOrderDetail(orderId);
  const acknowledge = useAcknowledgeRiskIncident();
  const [recipient, setRecipient] = useState<OrderContactRole>('client');

  const handleAcknowledge = async (incidentId: string) => {
    try {
      await acknowledge.mutateAsync({ incidentId, resolve: false });
      enqueueSnackbar(
        t('admin.orders.acknowledgeSuccess', 'Risk acknowledged'),
        { variant: 'success' }
      );
      refetch();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.orders.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
    }
  };

  const handleResolve = async (
    incidentId: string,
    payload: ResolveEscalationPayload
  ) => {
    try {
      await acknowledge.mutateAsync({
        incidentId,
        resolve: true,
        note: payload.notes,
        contact_channel: payload.contact_channel,
        order_result: payload.order_result,
      });
      enqueueSnackbar(
        t('admin.orders.incidentResolved', 'Incident resolved'),
        { variant: 'success' }
      );
      refetch();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('admin.orders.actionFailed', 'Action failed'),
        { variant: 'error' }
      );
      throw err;
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !data) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refetch}>
              {t('common.retry', 'Retry')}
            </Button>
          }
        >
          {t('admin.orders.detailError', 'Could not load this order.')}
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/admin/orders')}>
          {t('admin.orders.backToQueue', 'Back to order operations')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton onClick={() => navigate('/admin/orders')}>
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Typography variant="h5">
              {t('admin.orders.orderTitle', 'Order {{number}}', {
                number: data.order_number,
              })}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
              <OrderRiskChip level={data.risk_level} />
              <Chip
                size="small"
                label={data.current_status.replace(/_/g, ' ')}
                color={statusColor(data.current_status)}
              />
              <Typography variant="body2" color="text.secondary">
                {formatOrderAmount(data.total_amount, data.currency)}
              </Typography>
            </Stack>
          </Box>
        </Stack>
        <Tooltip title={t('common.refresh', 'Refresh')}>
          <IconButton onClick={refetch}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Stack spacing={3}>
            <OrderRiskIncidentsCard
              incidents={data.risk_incidents}
              nextAction={data.next_action}
              isAcknowledging={acknowledge.isPending}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
            />
            <OrderTimingCard timing={data.timing} />
            <OrderTimelineCard
              timeline={data.timeline}
              messages={data.messages}
            />
          </Stack>
        </Grid>

        <Grid item xs={12} md={5}>
          <Stack spacing={3}>
            <OrderParticipantsCard
              contacts={data.contacts}
              onMessage={setRecipient}
            />
            <OrderInterventionPanel
              order={data}
              initialRecipient={recipient}
              onChanged={refetch}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
};

const OrderTimingCard: React.FC<{ timing: AdminOrderTiming }> = ({
  timing,
}) => {
  const { t } = useTranslation();
  const rows: Array<[string, string | null]> = [
    [t('admin.orders.timing.created', 'Created'), timing.created_at],
    [t('admin.orders.lastUpdated', 'Last updated'), timing.updated_at],
    [
      t('admin.orders.timing.acceptanceDeadline', 'Acceptance deadline'),
      timing.acceptance_deadline_at,
    ],
    [
      t('admin.orders.timing.promisedReady', 'Promised ready'),
      timing.promised_ready_at,
    ],
    [t('admin.orders.timing.pickupDue', 'Pickup due'), timing.pickup_due_at],
    [
      t('admin.orders.timing.estimatedDelivery', 'Estimated delivery'),
      timing.estimated_delivery_time,
    ],
    [
      t('admin.orders.timing.promise', 'Fulfillment promise'),
      timing.promised_fulfill_by,
    ],
    [
      t('admin.orders.timing.deliveryWindow', 'Delivery window ends'),
      timing.delivery_window_end,
    ],
  ];
  const present = rows.filter(([, value]) => !!value);

  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          {t('admin.orders.timing.title', 'Commitments')}
        </Typography>
        {present.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t(
              'admin.orders.timing.none',
              'No deadlines are recorded for this order.'
            )}
          </Typography>
        ) : (
          <Stack spacing={0.5}>
            {present.map(([label, value]) => (
              <Stack
                key={label}
                direction="row"
                justifyContent="space-between"
                spacing={2}
              >
                <Typography variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography variant="body2">
                  {new Date(value as string).toLocaleString()}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminOrderDetailPage;
