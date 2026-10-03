import { Chip, Grid, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { PlatformOrderMetrics } from '../../../hooks/useAdminPerformance';
import { PerformanceMetricCard } from './PerformanceMetricCard';

interface PlatformOrdersOverviewProps {
  orders: PlatformOrderMetrics | null;
}

function rateLabel(value: number | undefined): string {
  if (value == null) return '—';
  return `${value}%`;
}

export const PlatformOrdersOverview: React.FC<PlatformOrdersOverviewProps> = ({
  orders,
}) => {
  const { t } = useTranslation();
  const fulfillment = orders?.byFulfillment;
  const cards: Array<[string, string, React.ReactNode]> = [
    ['admin.performance.platform.totalOrders', 'Total orders', orders?.total ?? null],
    ['admin.performance.platform.completed', 'Completed', orders?.completed ?? null],
    ['admin.performance.platform.cancelled', 'Cancelled', orders?.cancelled ?? null],
    [
      'admin.performance.platform.completionRate',
      'Completion rate',
      rateLabel(orders?.completionRate),
    ],
    [
      'admin.performance.platform.uniqueClients',
      'Customers',
      orders?.uniqueClients ?? null,
    ],
  ];

  return (
    <>
      <Grid container spacing={2}>
        {cards.map(([key, fallback, value]) => (
          <Grid key={key} size={{ xs: 6, sm: 4, md: 2.4 }}>
            <PerformanceMetricCard label={t(key, fallback)} value={value} />
          </Grid>
        ))}
      </Grid>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
        <Chip
          size="small"
          variant="outlined"
          label={t('admin.performance.platform.cancellationRate', 'Cancellation {{rate}}%', {
            rate: orders?.cancellationRate ?? '—',
          })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('admin.performance.platform.failed', 'Failed {{count}}', {
            count: orders?.failed ?? '—',
          })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('admin.performance.platform.refunds', 'Refunds {{count}}', {
            count: orders?.refunds ?? '—',
          })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('admin.performance.platform.inProgress', 'In progress {{count}}', {
            count: orders?.inProgress ?? '—',
          })}
        />
        <Chip
          size="small"
          variant="outlined"
          label={t('admin.performance.platform.pendingPayment', 'Awaiting payment {{count}}', {
            count: orders?.pendingPayment ?? '—',
          })}
        />
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
          {t(
            'admin.performance.platform.fulfillmentSplit',
            'Delivery {{delivery}} · Pickup {{pickup}} · Shipping {{shipping}}',
            {
              delivery: fulfillment?.delivery ?? '—',
              pickup: fulfillment?.pickup ?? '—',
              shipping: fulfillment?.shipping ?? '—',
            }
          )}
        </Typography>
      </Stack>
    </>
  );
};
