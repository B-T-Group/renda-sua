import { Warning as WarningIcon } from '@mui/icons-material';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { InventorySummary } from './itemViewHelpers';

interface ItemInventorySummaryProps {
  summary: InventorySummary;
}

interface StatProps {
  label: string;
  value: React.ReactNode;
  color?: string;
}

const Stat: React.FC<StatProps> = ({ label, value, color }) => (
  <Box sx={{ flex: '1 1 120px', minWidth: 100 }}>
    <Typography variant="caption" color="text.secondary" noWrap>
      {label}
    </Typography>
    <Typography variant="h6" fontWeight={700} sx={{ color: color ?? 'inherit' }}>
      {value}
    </Typography>
  </Box>
);

const ItemInventorySummary: React.FC<ItemInventorySummaryProps> = ({
  summary,
}) => {
  const { t } = useTranslation();

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: 'primary.light',
        bgcolor: 'primary.50',
      }}
    >
      <Stack
        direction="row"
        flexWrap="wrap"
        useFlexGap
        gap={2}
        alignItems="flex-start"
      >
        <Stat
          label={t('business.inventory.totalAvailable', 'Total Available')}
          value={summary.totalAvailable}
          color="success.main"
        />
        <Stat
          label={t('business.inventory.totalReserved', 'Reserved')}
          value={summary.totalReserved}
          color="warning.main"
        />
        <Stat
          label={t('business.inventory.totalStock', 'Total Stock')}
          value={summary.totalStock}
        />
        <Box sx={{ flex: '1 1 120px', minWidth: 100 }}>
          <Typography variant="caption" color="text.secondary" noWrap>
            {t('business.inventory.locations', 'Locations')}
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
            {summary.locationsWithStock > 0 && (
              <Chip
                label={summary.locationsWithStock}
                size="small"
                color="success"
                sx={{ height: 24 }}
              />
            )}
            {summary.locationsLowStock > 0 && (
              <Chip
                label={summary.locationsLowStock}
                size="small"
                color="warning"
                sx={{ height: 24 }}
                icon={<WarningIcon />}
              />
            )}
            {summary.locationsOutOfStock > 0 && (
              <Chip
                label={summary.locationsOutOfStock}
                size="small"
                color="error"
                sx={{ height: 24 }}
              />
            )}
            {summary.totalLocations === 0 && (
              <Typography variant="body2" color="text.secondary">
                0
              </Typography>
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default ItemInventorySummary;
