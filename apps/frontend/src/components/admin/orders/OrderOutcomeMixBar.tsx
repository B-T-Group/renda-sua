import { Box, Stack, Tooltip, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminOrderStats } from '../../../hooks/useAdminOrders';

interface OutcomeSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

function buildSegments(
  counts: AdminOrderStats['counts'],
  t: ReturnType<typeof useTranslation>['t']
): OutcomeSegment[] {
  return [
    {
      key: 'completed',
      label: t('admin.orders.stats.completed', 'Completed'),
      value: counts.completed,
      color: 'success.main',
    },
    {
      key: 'in_progress',
      label: t('admin.orders.stats.inProgress', 'In progress'),
      value: counts.in_progress,
      color: 'info.main',
    },
    {
      key: 'cancelled',
      label: t('admin.orders.stats.cancelled', 'Cancelled'),
      value: counts.cancelled,
      color: 'warning.main',
    },
    {
      key: 'failed',
      label: t('admin.orders.stats.failed', 'Failed'),
      value: counts.failed,
      color: 'error.main',
    },
    {
      key: 'refunds',
      label: t('admin.orders.stats.refunds', 'Refunds'),
      value: counts.refunds,
      color: 'secondary.main',
    },
    {
      key: 'pending_payment',
      label: t('admin.orders.stats.pendingPayment', 'Awaiting payment'),
      value: counts.pending_payment,
      color: 'grey.400',
    },
  ].filter((segment) => segment.value > 0);
}

/** Single glance at how the period's orders ended up, with a labelled legend. */
export const OrderOutcomeMixBar: React.FC<{
  counts: AdminOrderStats['counts'];
}> = ({ counts }) => {
  const { t } = useTranslation();
  const segments = buildSegments(counts, t);
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  if (total === 0) return null;

  return (
    <Stack spacing={1.25}>
      <Box
        role="img"
        aria-label={t('admin.orders.stats.mixLabel', 'Order outcome mix')}
        sx={{
          display: 'flex',
          height: 10,
          borderRadius: 5,
          overflow: 'hidden',
          bgcolor: 'action.hover',
        }}
      >
        {segments.map((segment) => (
          <Tooltip
            key={segment.key}
            title={`${segment.label}: ${segment.value} (${Math.round(
              (segment.value / total) * 100
            )}%)`}
          >
            <Box sx={{ flexGrow: segment.value, bgcolor: segment.color }} />
          </Tooltip>
        ))}
      </Box>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        {segments.map((segment) => (
          <Stack
            key={segment.key}
            direction="row"
            spacing={0.75}
            alignItems="center"
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: segment.color,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {segment.label} · {segment.value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
};
