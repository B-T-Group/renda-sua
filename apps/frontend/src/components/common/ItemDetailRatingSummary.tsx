import { ChevronRight as ChevronRightIcon } from '@mui/icons-material';
import { ButtonBase, Rating, Skeleton, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { OrderRating } from '../../hooks/useOrderRatings';

export type ItemDetailRatingSummaryProps = {
  ratings: OrderRating[];
  loading: boolean;
  onOpenReviews: () => void;
  onTrackOpen?: () => void;
};

function averageRating(rows: OrderRating[]): number | null {
  if (!rows.length) return null;
  const sum = rows.reduce((acc, r) => acc + (typeof r.rating === 'number' ? r.rating : 0), 0);
  return sum / rows.length;
}

export function ItemDetailRatingSummary({
  ratings,
  loading,
  onOpenReviews,
  onTrackOpen,
}: ItemDetailRatingSummaryProps) {
  const { t } = useTranslation();
  if (loading) {
    return <Skeleton variant="rounded" height={28} sx={{ maxWidth: 220, borderRadius: 1 }} />;
  }
  const avg = averageRating(ratings);
  if (avg == null || !Number.isFinite(avg)) return null;

  const label = t('items.detail.rating.summaryLine', '{{count}} reviews', {
    count: ratings.length,
  });

  return (
    <ButtonBase
      onClick={() => {
        onTrackOpen?.();
        onOpenReviews();
      }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        width: '100%',
        justifyContent: 'flex-start',
        borderRadius: 1,
        py: 0.5,
        px: 0.5,
        minHeight: 44,
      }}
    >
      <Rating value={avg} precision={0.1} readOnly size="small" />
      <Typography variant="body2" color="text.secondary" noWrap component="span">
        {avg.toFixed(1)} ({label})
      </Typography>
      <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary', ml: 'auto' }} />
    </ButtonBase>
  );
}
