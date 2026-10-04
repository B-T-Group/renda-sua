import { Box, LinearProgress, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ObjectiveKey,
  ObjectiveMetric,
  ScheduleAssignmentDetail,
} from '../../hooks/usePaymentScheduleDetail';

const ROWS: Array<{
  key: ObjectiveKey;
  labelKey: string;
  fallback: string;
  money: boolean;
}> = [
  { key: 'itemSales', labelKey: 'accounts.schedules.itemSales', fallback: 'Item sales', money: true },
  { key: 'rentals', labelKey: 'accounts.schedules.rentals', fallback: 'Rentals', money: true },
  {
    key: 'clientSignups',
    labelKey: 'accounts.schedules.clientSignups',
    fallback: 'Client signups',
    money: false,
  },
  {
    key: 'merchantRecruitments',
    labelKey: 'accounts.schedules.merchantRecruitments',
    fallback: 'Merchant recruitments',
    money: false,
  },
  {
    key: 'agentRecruitments',
    labelKey: 'accounts.schedules.agentRecruitments',
    fallback: 'Agent recruitments',
    money: false,
  },
];

type Translator = (
  key: string,
  fallback: string,
  options?: Record<string, unknown>
) => string;

export function objectiveRowMeta(key: ObjectiveKey) {
  return ROWS.find((row) => row.key === key);
}

export function formatObjectivePair(
  actual: number,
  target: number,
  money: boolean,
  currency: string
) {
  const left = money ? actual.toLocaleString() : String(actual);
  const right = money ? target.toLocaleString() : String(target);
  return money ? `${left} / ${right} ${currency}` : `${left} / ${right}`;
}

export function objectiveGapLabel(
  key: ObjectiveKey,
  metric: ObjectiveMetric,
  currency: string,
  t: Translator
) {
  const remaining = Math.max(0, (metric.target ?? 0) - metric.actual);
  if (key === 'itemSales' || key === 'rentals') {
    return t(`accounts.schedules.focus.gap.${key}`, moneyGap(key), {
      amount: remaining.toLocaleString(),
      currency,
    });
  }
  const count = Math.max(1, Math.ceil(remaining));
  const one = count === 1;
  return t(`accounts.schedules.focus.gap.${key}${one ? 'One' : ''}`, countGap(key, one), {
    count,
  });
}

export function ObjectiveProgressList({
  progress,
  currency,
  showPercent,
}: {
  progress: ScheduleAssignmentDetail['progress'];
  currency: string;
  showPercent: boolean;
}) {
  const { t } = useTranslation();
  const rows = ROWS.filter((row) => progress[row.key].target != null);
  if (!rows.length) {
    return (
      <Typography variant="body2">
        {t('accounts.schedules.noObjectives', 'This plan has no attached objectives.')}
      </Typography>
    );
  }
  return (
    <Stack spacing={1.5}>
      {rows.map((row) => (
        <ObjectiveRow
          key={row.key}
          label={t(row.labelKey, row.fallback)}
          metric={progress[row.key]}
          currency={currency}
          money={row.money}
          showPercent={showPercent}
        />
      ))}
    </Stack>
  );
}

function ObjectiveRow({
  label,
  metric,
  currency,
  money,
  showPercent,
}: {
  label: string;
  metric: ObjectiveMetric;
  currency: string;
  money: boolean;
  showPercent: boolean;
}) {
  const pair = formatObjectivePair(metric.actual, metric.target ?? 0, money, currency);
  const percent = showPercent ? metric.percent : null;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {percent != null ? `${percent}% · ${pair}` : pair}
        </Typography>
      </Box>
      {percent != null ? <LinearProgress variant="determinate" value={percent} /> : null}
    </Box>
  );
}

function moneyGap(key: ObjectiveKey) {
  if (key === 'rentals') return 'Next: {{amount}} {{currency}} more in rentals';
  return 'Next: {{amount}} {{currency}} more in item sales';
}

function countGap(key: ObjectiveKey, one: boolean) {
  if (key === 'clientSignups') {
    return one ? 'Next: 1 more client signup' : 'Next: {{count}} more client signups';
  }
  if (key === 'merchantRecruitments') {
    return one
      ? 'Next: 1 more merchant recruitment'
      : 'Next: {{count}} more merchant recruitments';
  }
  return one ? 'Next: 1 more agent recruitment' : 'Next: {{count}} more agent recruitments';
}
