import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

export type ItemDetailDealCountdownProps = {
  dealEndAt: string;
  discountPercent?: number | null;
};

export function ItemDetailDealCountdown({ dealEndAt, discountPercent }: ItemDetailDealCountdownProps) {
  const { t } = useTranslation();
  const endMs = Date.parse(dealEndAt);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!Number.isFinite(endMs)) return undefined;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [endMs]);

  if (!Number.isFinite(endMs)) return null;
  const remaining = endMs - now;
  const time = formatRemaining(remaining);
  const offer =
    discountPercent != null && discountPercent > 0
      ? t('items.detail.dealCountdown.offerPct', '{{pct}}% off · {{time}}', {
          pct: discountPercent,
          time,
        })
      : t('items.detail.dealCountdown.offerTime', 'Deal ends · {{time}}', { time });

  return (
    <Chip
      size="small"
      color="primary"
      variant="filled"
      sx={{ width: 'fit-content', fontWeight: 700 }}
      label={offer}
    />
  );
}
