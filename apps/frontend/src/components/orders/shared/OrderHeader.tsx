import { Refresh } from '@mui/icons-material';
import { Box, Chip, IconButton, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from './StatusBadge';

export interface OrderHeaderProps {
  orderNumber: string;
  status: string;
  statusLabel?: string;
  live?: boolean;
  onRefresh?: () => void;
  subtitle?: string | null;
  trailing?: React.ReactNode;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
  orderNumber,
  status,
  statusLabel,
  live = false,
  onRefresh,
  subtitle,
  trailing,
}) => {
  const { t } = useTranslation();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      sx={{ mb: 2 }}
    >
      <Box>
        <Typography variant="h5" fontWeight={800}>
          {t('orders.orderNumber', 'Order #{{orderNumber}}', { orderNumber })}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
        <StatusBadge
          status={status}
          label={statusLabel}
          size="medium"
          showCompletedIcon
        />
        {live ? (
          <Chip
            size="small"
            label={t('orders.liveUpdates', 'Live')}
            color="success"
            variant="outlined"
            sx={{ fontWeight: 500 }}
          />
        ) : null}
        {onRefresh ? (
          <IconButton onClick={onRefresh} size="small" aria-label="refresh">
            <Refresh />
          </IconButton>
        ) : null}
        {trailing}
      </Stack>
    </Stack>
  );
};

export default OrderHeader;
