import { AccessTime, Warning } from '@mui/icons-material';
import { Chip, Stack, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface CountdownProps {
  deadlineAt: string | Date | null | undefined;
  label?: string;
  overdueLabel?: string;
  compact?: boolean;
}

function remainingMs(deadline: Date, now: number): number {
  return deadline.getTime() - now;
}

function formatRemaining(ms: number, t: (k: string, d: string) => string): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return t('orders.countdown.hoursMinutes', '{{hours}}h {{mins}}m', {
      hours,
      mins: remMins,
    } as never);
  }
  if (mins > 0) {
    return t('orders.countdown.minutesSeconds', '{{mins}}m {{secs}}s', {
      mins,
      secs,
    } as never);
  }
  return t('orders.countdown.seconds', '{{secs}}s', { secs } as never);
}

export const Countdown: React.FC<CountdownProps> = ({
  deadlineAt,
  label,
  overdueLabel,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadlineAt) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  if (!deadlineAt) return null;

  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return null;

  const ms = remainingMs(deadline, now);
  const overdue = ms <= 0;
  const text = overdue
    ? overdueLabel ?? t('orders.countdown.overdue', 'Overdue')
    : formatRemaining(ms, t as never);

  if (compact) {
    return (
      <Chip
        size="small"
        icon={overdue ? <Warning /> : <AccessTime />}
        color={overdue ? 'error' : 'warning'}
        label={label ? `${label}: ${text}` : text}
        sx={{ fontWeight: 600 }}
      />
    );
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {overdue ? <Warning color="error" fontSize="small" /> : <AccessTime color="warning" fontSize="small" />}
      <Typography
        variant="body2"
        color={overdue ? 'error.main' : 'warning.main'}
        fontWeight={600}
      >
        {label ? `${label}: ${text}` : text}
      </Typography>
    </Stack>
  );
};

export default Countdown;
