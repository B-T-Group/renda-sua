import { Chip } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type ItemDetailScarcityBadgeProps = {
  quantity: number;
};

export function ItemDetailScarcityBadge({ quantity }: ItemDetailScarcityBadgeProps) {
  const { t } = useTranslation();
  if (quantity > 5) return null;
  return (
    <Chip
      size="small"
      color="warning"
      variant="outlined"
      sx={{ width: 'fit-content', fontWeight: 700 }}
      label={t('items.detail.scarcity.onlyLeft', 'Only {{count}} left in stock', { count: quantity })}
    />
  );
}
