import { Box, Card, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminMapActivity, AdminMapSummary } from './adminMap.types';
import { pinColor } from './adminMapMarker';

const AGENT_STATUSES = ['active', 'unavailable', 'suspended'] as const;
const MERCHANT_STATUSES = ['open', 'inactive'] as const;

const AdminMapSummaryBar: React.FC<{ summary: AdminMapSummary }> = ({ summary }) => {
  const { t } = useTranslation();
  return (
    <Stack spacing={0.75}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <GroupCard title={t('admin.map.kindAgents', 'Agents')} statuses={AGENT_STATUSES} counts={summary.agents} />
        <GroupCard title={t('admin.map.kindMerchants', 'Merchants')} statuses={MERCHANT_STATUSES} counts={summary.merchants} />
      </Stack>
      <SummaryHint />
    </Stack>
  );
};

function SummaryHint() {
  const { t } = useTranslation();
  return (
    <Typography variant="caption" color="text.secondary">
      {t(
        'admin.map.summaryHint',
        'Totals for the selected country and region, including people without a map position.'
      )}
    </Typography>
  );
}

function GroupCard<T extends AdminMapActivity>({
  title,
  statuses,
  counts,
}: {
  title: string;
  statuses: readonly T[];
  counts: Record<T, number>;
}) {
  return (
    <Card variant="outlined" sx={{ px: 2, py: 1.25, flex: 1 }}>
      <GroupHeading title={title} total={sumCounts(statuses, counts)} />
      <StatusRow statuses={statuses} counts={counts} />
    </Card>
  );
}

function GroupHeading({ title, total }: { title: string; total: number }) {
  return (
    <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mb: 0.75 }}>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="h6" component="span">{total}</Typography>
    </Stack>
  );
}

function StatusRow<T extends AdminMapActivity>({
  statuses,
  counts,
}: {
  statuses: readonly T[];
  counts: Record<T, number>;
}) {
  const { t } = useTranslation();
  return (
    <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
      {statuses.map((status) => (
        <StatusCount key={status} status={status} count={counts[status]} label={t(`admin.map.activity.${status}`, status)} />
      ))}
    </Stack>
  );
}

function StatusCount({ status, count, label }: { status: AdminMapActivity; count: number; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: pinColor(status) }} />
      <Typography variant="body2" component="span" sx={{ fontWeight: 700 }}>{count}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}

function sumCounts<T extends string>(statuses: readonly T[], counts: Record<T, number>): number {
  return statuses.reduce((sum, status) => sum + counts[status], 0);
}

export default AdminMapSummaryBar;
