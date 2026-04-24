import { LocalShipping as LocalShippingIcon, Visibility as VisibilityIcon } from '@mui/icons-material';
import { Chip, Skeleton, Stack } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type ItemDetailSocialProofProps = {
  viewsCount?: number | null;
  recentOrders30d?: number | null;
  statsLoading?: boolean;
};

export function ItemDetailSocialProof({
  viewsCount,
  recentOrders30d,
  statsLoading,
}: ItemDetailSocialProofProps) {
  const { t } = useTranslation();
  const hasViews = typeof viewsCount === 'number';
  const hasOrders = typeof recentOrders30d === 'number' && recentOrders30d > 0;
  const showStatsSkeleton = Boolean(statsLoading && !hasViews);

  if (!hasViews && !hasOrders && !statsLoading) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {showStatsSkeleton ? <Skeleton variant="rounded" width={120} height={28} /> : null}
      {hasViews ? (
        <Chip
          icon={<VisibilityIcon />}
          size="small"
          variant="outlined"
          sx={{ minHeight: 36, fontWeight: 600 }}
          label={t('items.detail.socialProof.views', '{{count}} views', { count: viewsCount })}
        />
      ) : null}
      {hasOrders ? (
        <Chip
          icon={<LocalShippingIcon />}
          size="small"
          variant="outlined"
          sx={{ minHeight: 36, fontWeight: 600 }}
          label={t('items.detail.socialProof.orders30d', '{{count}} orders (30d)', {
            count: recentOrders30d,
          })}
        />
      ) : null}
    </Stack>
  );
}
