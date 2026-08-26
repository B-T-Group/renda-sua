import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Grid,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { TFunction } from 'i18next';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAdminOrderStats,
  type AdminOrderStats,
  type AdminOrderStatsPeriod,
} from '../../../hooks/useAdminOrders';
import { OrderOutcomeMixBar } from './OrderOutcomeMixBar';
import { OrderStatsTile } from './OrderStatsTile';
import { formatMinutes } from './orderRiskLabels';

const PERIOD_OPTIONS: Array<{
  value: AdminOrderStatsPeriod;
  key: string;
  fallback: string;
}> = [
  { value: 'today', key: 'admin.orders.stats.periods.today', fallback: 'Today' },
  { value: '7d', key: 'admin.orders.stats.periods.last7Days', fallback: '7 days' },
  {
    value: '30d',
    key: 'admin.orders.stats.periods.last30Days',
    fallback: '30 days',
  },
  { value: 'all', key: 'admin.orders.stats.periods.all', fallback: 'All time' },
];

const EMPTY_VALUE = '—';

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatRate(t: TFunction, rate: number | null): string | null {
  if (rate === null) return null;
  return t('admin.orders.stats.ofSettled', '{{rate}}% of settled orders', {
    rate,
  });
}

function formatDuration(t: TFunction, minutes: number | null): string {
  return minutes === null ? EMPTY_VALUE : formatMinutes(t, minutes);
}

function sampleCaption(t: TFunction, count: number): string | null {
  if (count === 0) return t('admin.orders.stats.noData', 'Not enough data yet');
  return t('admin.orders.stats.basedOn', 'from {{count}} orders', { count });
}

function outcomeTiles(t: TFunction, stats: AdminOrderStats) {
  const { counts, rates } = stats;
  return [
    {
      label: t('admin.orders.stats.total', 'Orders'),
      value: formatCount(counts.total),
      caption: t('admin.orders.stats.totalCaption', 'Created in this period'),
    },
    {
      label: t('admin.orders.stats.completed', 'Completed'),
      value: formatCount(counts.completed),
      caption: formatRate(t, rates.completion_rate),
      accent: 'success.main',
    },
    {
      label: t('admin.orders.stats.inProgress', 'In progress'),
      value: formatCount(counts.in_progress),
      caption: t('admin.orders.stats.inProgressCaption', 'Still in flight'),
      accent: 'info.main',
    },
    {
      label: t('admin.orders.stats.cancelled', 'Cancelled'),
      value: formatCount(counts.cancelled),
      caption: formatRate(t, rates.cancellation_rate),
      accent: 'warning.main',
    },
  ];
}

function durationTiles(t: TFunction, stats: AdminOrderStats) {
  const { averages } = stats;
  return [
    {
      label: t('admin.orders.stats.avgAcceptance', 'Avg merchant acceptance'),
      value: formatDuration(t, averages.acceptance_minutes),
      caption: sampleCaption(t, averages.samples.acceptance),
    },
    {
      label: t('admin.orders.stats.avgPrep', 'Avg prep time'),
      value: formatDuration(t, averages.prep_minutes),
      caption: sampleCaption(t, averages.samples.prep),
    },
    {
      label: t('admin.orders.stats.avgDelivery', 'Avg delivery time'),
      value: formatDuration(t, averages.delivery_minutes),
      caption: sampleCaption(t, averages.samples.delivery),
    },
    {
      label: t('admin.orders.stats.avgCompletion', 'Avg order to completion'),
      value: formatDuration(t, averages.completion_minutes),
      caption: sampleCaption(t, averages.samples.completion),
    },
  ];
}

interface OrderStatsSectionProps {
  /** Bump to re-read stats, so the page refresh button covers this card too. */
  refreshToken?: number;
}

/** Period-scoped order outcomes and cycle times above the operations queue. */
export const OrderStatsSection: React.FC<OrderStatsSectionProps> = ({
  refreshToken = 0,
}) => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<AdminOrderStatsPeriod>('7d');
  const { data, error, refetch } = useAdminOrderStats(period);
  const lastToken = useRef(refreshToken);
  /** Never pair one period's numbers with another period's label. */
  const stats = data && data.period === period ? data : null;

  useEffect(() => {
    if (lastToken.current === refreshToken) return;
    lastToken.current = refreshToken;
    refetch();
  }, [refreshToken, refetch]);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
          spacing={1.5}
          sx={{ mb: 2 }}
        >
          <Typography variant="h6">
            {t('admin.orders.stats.title', 'Order performance')}
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={period}
            onChange={(_e, value) => value && setPeriod(value)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <ToggleButton key={option.value} value={option.value}>
                {t(option.key, option.fallback)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Stack>

        {error ? (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={refetch}>
                {t('common.retry', 'Retry')}
              </Button>
            }
          >
            {t('admin.orders.stats.error', 'Failed to load order statistics')}
          </Alert>
        ) : !stats ? (
          <StatsSkeleton />
        ) : stats.counts.total === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('admin.orders.stats.empty', 'No orders were created in this period.')}
          </Typography>
        ) : (
          <StatsBody stats={stats} />
        )}
      </CardContent>
    </Card>
  );
};

const StatsBody: React.FC<{ stats: AdminOrderStats }> = ({ stats }) => {
  const { t } = useTranslation();

  return (
    <Stack spacing={2.5}>
      <Grid container spacing={2}>
        {outcomeTiles(t, stats).map((tile) => (
          <Grid key={tile.label} size={{ xs: 6, md: 3 }}>
            <OrderStatsTile {...tile} />
          </Grid>
        ))}
      </Grid>

      <OrderOutcomeMixBar counts={stats.counts} />

      <Divider />

      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('admin.orders.stats.cycleTimes', 'Average cycle times')}
        </Typography>
        <Grid container spacing={2}>
          {durationTiles(t, stats).map((tile) => (
            <Grid key={tile.label} size={{ xs: 6, md: 3 }}>
              <OrderStatsTile {...tile} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Stack>
  );
};

const StatsSkeleton: React.FC = () => (
  <Grid container spacing={2}>
    {Array.from({ length: 8 }).map((_value, index) => (
      <Grid key={index} size={{ xs: 6, md: 3 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="40%" height={36} />
      </Grid>
    ))}
  </Grid>
);
