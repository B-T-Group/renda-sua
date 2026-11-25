import { Box, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { BusinessRentalItemActivityStats } from '../../hooks/useRentalApi';
import { formatRequestAmount } from '../../utils/rentalRequestDisplay';

export function RentalItemActivityStatsStrip({
  stats,
}: {
  stats: BusinessRentalItemActivityStats;
}) {
  const { t, i18n } = useTranslation();
  const currency = stats.currency || 'XAF';
  const cells = [
    {
      key: 'earned',
      label: t('business.rentals.activity.earned', 'Earned'),
      value: formatRequestAmount(stats.earnedTotal, currency, i18n.language),
    },
    {
      key: 'times',
      label: t('business.rentals.activity.timesRented', 'Times rented'),
      value: String(stats.timesRented),
    },
    {
      key: 'out',
      label: t('business.rentals.activity.currentlyOut', 'Out now'),
      value: String(stats.currentlyOut),
    },
    {
      key: 'upcoming',
      label: t('business.rentals.activity.upcoming', 'Upcoming'),
      value: String(stats.upcoming),
    },
  ];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        gap: 1.5,
        p: 1.5,
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'background.paper',
      }}
    >
      {cells.map((cell) => (
        <Stack key={cell.key} spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {cell.label}
          </Typography>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            {cell.value}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

export default RentalItemActivityStatsStrip;
