import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import { useApiClient } from '../../hooks/useApiClient';
import { usePickupOpsAdmin } from '../../hooks/usePickupOpsAdmin';

function healthColor(
  health: string
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (health) {
    case 'Healthy':
      return 'success';
    case 'Approaching SLA':
      return 'info';
    case 'At Risk':
      return 'warning';
    case 'Overdue':
    case 'Reassigning':
      return 'error';
    default:
      return 'default';
  }
}

const AdminPickupOpsPage: React.FC = () => {
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { orders, kpis, loading, error, refresh } = usePickupOpsAdmin();

  const pauseOrder = async (orderId: string) => {
    await apiClient.post(`/orders/${orderId}/pickup-pause`, {
      reason: 'support_hold',
    });
    await refresh();
  };

  const resumeOrder = async (orderId: string) => {
    await apiClient.post(`/orders/${orderId}/pickup-resume`, {});
    await refresh();
  };

  if (loading && !kpis) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h4">
          {t('admin.pickupOps.title', 'Pickup operations')}
        </Typography>
        <Button variant="outlined" onClick={() => void refresh()}>
          {t('common.refresh', 'Refresh')}
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {kpis && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            {
              label: t('admin.pickupOps.liveAssigned', 'Live assigned'),
              value: kpis.assignedLiveCount,
            },
            {
              label: t('admin.pickupOps.atRisk', 'At risk events'),
              value: kpis.atRiskCount,
            },
            {
              label: t('admin.pickupOps.overdue', 'Overdue events'),
              value: kpis.overdueCount,
            },
            {
              label: t('admin.pickupOps.reassignments', 'Reassignments'),
              value: kpis.reassignmentStartedCount,
            },
            {
              label: t('admin.pickupOps.slaCompliance', 'SLA compliance %'),
              value:
                kpis.slaComplianceRate != null
                  ? `${kpis.slaComplianceRate}%`
                  : '—',
            },
            {
              label: t('admin.pickupOps.avgDelay', 'Avg pickup delay (min)'),
              value:
                kpis.averagePickupDelayMinutes != null
                  ? kpis.averagePickupDelayMinutes
                  : '—',
            },
            {
              label: t('admin.pickupOps.reassignmentRate', 'Reassignment rate %'),
              value:
                kpis.reassignmentRate != null
                  ? `${kpis.reassignmentRate}%`
                  : '—',
            },
            {
              label: t('admin.pickupOps.merchantDelays', 'Merchant delays'),
              value: kpis.merchantDelayCount,
            },
          ].map((card) => (
            <Grid item xs={12} sm={6} md={3} key={card.label}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography variant="h5">{card.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('admin.pickupOps.healthBoard', 'Assigned order health')}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{t('orders.orderNumber', 'Order')}</TableCell>
            <TableCell>{t('admin.pickupOps.health', 'Health')}</TableCell>
            <TableCell>{t('admin.pickupOps.state', 'State')}</TableCell>
            <TableCell>{t('admin.pickupOps.due', 'Due')}</TableCell>
            <TableCell>{t('business.name', 'Business')}</TableCell>
            <TableCell>{t('admin.pickupOps.agent', 'Agent')}</TableCell>
            <TableCell>{t('common.actions', 'Actions')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.map((row) => {
            const agentName = [
              row.assigned_agent?.user?.first_name,
              row.assigned_agent?.user?.last_name,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <Button
                    component={RouterLink}
                    to={`/orders/${row.id}`}
                    size="small"
                  >
                    {row.order_number}
                  </Button>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.displayHealth}
                    color={healthColor(row.displayHealth)}
                  />
                </TableCell>
                <TableCell>{row.pickup_state || '—'}</TableCell>
                <TableCell>
                  {row.pickup_due_at
                    ? new Date(row.pickup_due_at).toLocaleString()
                    : '—'}
                </TableCell>
                <TableCell>{row.business?.name || '—'}</TableCell>
                <TableCell>{agentName || '—'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    {row.pickup_state === 'paused' ? (
                      <Button
                        size="small"
                        onClick={() => void resumeOrder(row.id)}
                      >
                        {t('admin.pickupOps.resume', 'Resume')}
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => void pauseOrder(row.id)}
                      >
                        {t('admin.pickupOps.pause', 'Pause')}
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                {t(
                  'admin.pickupOps.empty',
                  'No assigned orders currently monitored.'
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
};

export default AdminPickupOpsPage;
